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

  // Staff say "45", not "ORD-20260823-0045".
  const shortNo = String(Number(order.orderNumber.split("-").pop()));
  const byShort = await asServer(`/api/orders?orderNumber=${shortNo}`);
  check(`short number "${shortNo}" resolves to the same ticket`,
    Array.isArray(byShort.body) && byShort.body[0]?.id === order.id,
    `got ${JSON.stringify(byShort.body).slice(0, 120)}`);

  const missing = await asServer(`/api/orders?orderNumber=999999`);
  check("an unknown ticket number returns nothing",
    Array.isArray(missing.body) && missing.body.length === 0);

  console.log("\n3. Add a service");
  const svcs = await asServer("/api/services");
  const svc = Array.isArray(svcs.body) ? svcs.body[0] : null;
  check("services are listable", !!svc, JSON.stringify(svcs.body).slice(0, 120));
  const added = await asServer(`/api/orders/${order.id}/items`, {
    method: "POST", body: JSON.stringify({ serviceId: svc.id }),
  });
  check("service line added", added.status === 201,
    `status ${added.status} ${JSON.stringify(added.body).slice(0, 160)}`);

  console.log("\n4. Cashier adds a forgotten service, credited to the stylist");
  const byCashier = await asCashier(`/api/orders/${order.id}/items`, {
    method: "POST",
    body: JSON.stringify({ serviceId: svc.id, staffId: sess.body.user.id }),
  });
  check("cashier can add on the stylist's behalf", byCashier.status === 201,
    `status ${byCashier.status} ${JSON.stringify(byCashier.body).slice(0, 140)}`);
  check("the line is credited to the stylist, not the cashier",
    byCashier.body?.staffId === sess.body.user.id,
    `credited to ${byCashier.body?.staffId}`);

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
  console.log("\n6b. Amounts are exact integers in santim");
  const inv = out.body?.invoice;
  if (inv) {
    // Read the rate off the invoice itself -- the cashier role has no
    // settings.view permission, and the invoice records the rate it used.
    const taxBp = inv.taxRate;
    const expectedSubtotal = svc.basePrice * 3;           // stylist, cashier, then late
    const expectedTax = Math.round((expectedSubtotal * taxBp) / 10000);
    const expectedTotal = expectedSubtotal + expectedTax;
    const fmt = (n: number) =>
      `${Math.floor(Math.abs(n) / 100).toLocaleString("en-US")}.${String(Math.abs(n) % 100).padStart(2, "0")}`;

    check("service price is an integer, not a decimal string",
      Number.isInteger(svc.basePrice), `basePrice=${svc.basePrice} (${typeof svc.basePrice})`);
    check("tax rate is basis points", Number.isInteger(taxBp), `taxRate=${taxBp}`);
    check("subtotal is exact", inv.subtotal === expectedSubtotal,
      `${inv.subtotal} vs ${expectedSubtotal}`);
    check("tax is exact", inv.taxAmount === expectedTax,
      `${inv.taxAmount} vs ${expectedTax}`);
    check("total is exact", inv.totalAmount === expectedTotal,
      `${inv.totalAmount} vs ${expectedTotal}`);
    check("every stored amount is a whole number of santim",
      [inv.subtotal, inv.taxAmount, inv.discountAmount, inv.tipAmount, inv.totalAmount]
        .every(Number.isInteger));
    check("payment matches the invoice total", out.body?.payment?.amount === inv.totalAmount,
      `${out.body?.payment?.amount} vs ${inv.totalAmount}`);
    console.log(`     ${inv.invoiceNumber}: ${fmt(inv.subtotal)} + ${fmt(inv.taxAmount)} tax = ETB ${fmt(inv.totalAmount)}`);
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

  console.log("\n8. A ticket with a percentage discount and a tip");
  {
    const t = await asServer("/api/orders", { method: "POST", body: "{}" });
    const tid = t.body?.id;
    await asServer(`/api/orders/${tid}/items`, {
      method: "POST", body: JSON.stringify({ serviceId: svc.id }),
    });

    // 10% off, 25.50 tip -- both sent in human units, as the till does.
    const paid = await asCashier(`/api/orders/${tid}/checkout`, {
      method: "POST",
      body: JSON.stringify({
        discountType: "PERCENTAGE", discountValue: 10, tipAmount: 25.5,
      }),
    });
    const i2 = paid.body?.invoice;
    check("discounted checkout succeeds", paid.status === 200, `status ${paid.status}`);
    if (i2) {
      const sub = svc.basePrice;
      const tax = Math.round((sub * i2.taxRate) / 10000);
      const disc = Math.round((sub * 1000) / 10000);   // 10% = 1000bp
      const tip = 2550;                                 // 25.50 ETB
      check("discount stored in basis points", i2.discountValue === 1000,
        `${i2.discountValue}`);
      check("discount amount is exact", i2.discountAmount === disc,
        `${i2.discountAmount} vs ${disc}`);
      check("a fractional tip survives as santim", i2.tipAmount === tip,
        `${i2.tipAmount} vs ${tip}`);
      check("total is exact with discount and tip",
        i2.totalAmount === sub + tax - disc + tip,
        `${i2.totalAmount} vs ${sub + tax - disc + tip}`);
    }
  }

  console.log("\n9. A discount larger than the bill is refused");
  {
    const t = await asServer("/api/orders", { method: "POST", body: "{}" });
    const tid = t.body?.id;
    await asServer(`/api/orders/${tid}/items`, {
      method: "POST", body: JSON.stringify({ serviceId: svc.id }),
    });
    const bad = await asCashier(`/api/orders/${tid}/checkout`, {
      method: "POST",
      body: JSON.stringify({ discountType: "FIXED", discountValue: 999999 }),
    });
    check("over-large discount rejected", bad.status === 400, `got ${bad.status}`);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
