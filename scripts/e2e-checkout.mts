/* eslint-disable @typescript-eslint/no-explicit-any -- this harness parses arbitrary API JSON; typing each shape adds noise without catching bugs */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  <- " + detail}`);
  if (!ok) failures++;
}

function mergeCookies(jar: Map<string, string>, res: Response) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
const cookieHeader = (jar: Map<string, string>) =>
  [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function login(email: string, password: string) {
  const jar = new Map<string, string>();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  mergeCookies(jar, csrfRes);
  const { csrfToken } = await csrfRes.json();

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({ email, password, csrfToken, redirect: "false" }),
    redirect: "manual",
  });
  mergeCookies(jar, res);
  return jar;
}

const api = (jar: Map<string, string>) =>
  async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(jar),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, body };
  };

async function main() {
  console.log("\nLogging in...");
  const serverJar = await login("server1@berchi.com", "password123");
  const cashierJar = await login("cashier@berchi.com", "password123");
  const asServer = api(serverJar);
  const asCashier = api(cashierJar);

  const sess = await asServer("/api/auth/session");
  check("stylist session established", !!sess.body?.user, JSON.stringify(sess.body));
  const csess = await asCashier("/api/auth/session");
  check("cashier session established", !!csess.body?.user, JSON.stringify(csess.body));

  console.log("\n1. Reception opens a ticket with no customer");
  const created = await asServer("/api/orders", { method: "POST", body: "{}" });
  check("ticket created without a customer", created.status === 201,
    `status ${created.status} ${JSON.stringify(created.body).slice(0, 160)}`);
  const order = created.body;
  if (!order?.id) { console.log("\nCannot continue.\n"); process.exit(1); }
  console.log(`     ticket ${order.orderNumber}, customer = ${order.customer}`);
  check("customer is null on a walk-in ticket", order.customer === null);

  console.log("\n2. Lookup by order number");
  const found = await asServer(`/api/orders?orderNumber=${order.orderNumber}`);
  check("ticket is findable by its printed number",
    Array.isArray(found.body) && found.body[0]?.id === order.id);

  console.log("\n3. Add a service");
  const svcs = await asServer("/api/services");
  const svc = Array.isArray(svcs.body) ? svcs.body[0] : null;
  check("services are listable", !!svc, JSON.stringify(svcs.body).slice(0, 120));
  const added = await asServer(`/api/orders/${order.id}/items`, {
    method: "POST", body: JSON.stringify({ serviceId: svc.id }),
  });
  check("service line added", added.status === 201,
    `status ${added.status} ${JSON.stringify(added.body).slice(0, 160)}`);

  console.log("\n4. Cashier cannot edit lines (permission boundary)");
  const denied = await asCashier(`/api/orders/${order.id}/items`, {
    method: "POST", body: JSON.stringify({ serviceId: svc.id }),
  });
  check("cashier is refused orders.update", denied.status === 403,
    `got ${denied.status}`);

  console.log("\n5. Send, then add again (send must not lock)");
  const sent = await asServer(`/api/orders/${order.id}/send`, { method: "POST" });
  check("ticket sent to cashier", sent.status === 200, `status ${sent.status}`);
  const late = await asServer(`/api/orders/${order.id}/items`, {
    method: "POST", body: JSON.stringify({ serviceId: svc.id }),
  });
  check("a late service still lands after sending", late.status === 201,
    `status ${late.status} ${JSON.stringify(late.body).slice(0, 160)}`);

  console.log("\n6. Confirm payment with no method in the payload");
  const out = await asCashier(`/api/orders/${order.id}/checkout`, {
    method: "POST",
    body: JSON.stringify({ discountType: null, discountValue: 0, tipAmount: 0 }),
  });
  check("checkout succeeds without a paymentMethod", out.status === 200,
    `status ${out.status} ${JSON.stringify(out.body).slice(0, 200)}`);
  check("an invoice was created", !!out.body?.invoice?.invoiceNumber,
    JSON.stringify(out.body).slice(0, 160));
  check("payment recorded as CASH by default", out.body?.payment?.method === "CASH",
    `got ${out.body?.payment?.method}`);
  if (out.body?.invoice) {
    console.log(`     invoice ${out.body.invoice.invoiceNumber}, total ${out.body.invoice.totalAmount}`);
  }

  console.log("\n7. A closed ticket is closed");
  const again = await asServer(`/api/orders/${order.id}/items`, {
    method: "POST", body: JSON.stringify({ serviceId: svc.id }),
  });
  check("no further edits after checkout", again.status === 409, `got ${again.status}`);
  const twice = await asCashier(`/api/orders/${order.id}/checkout`, {
    method: "POST", body: JSON.stringify({}),
  });
  check("cannot be paid twice", twice.status === 409, `got ${twice.status}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
