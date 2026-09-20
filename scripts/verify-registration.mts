/* eslint-disable @typescript-eslint/no-explicit-any -- this harness parses arbitrary API JSON; typing each shape adds noise without catching bugs */
// Checks registration (name + number + slip), arrival order, and payment
// methods end to end against a running server.
//
//   npm run test:registration
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
      redirect: "manual",
      ...init,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(jar),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : text; } catch { body = text; }
    return { status: res.status, body, headers: res.headers };
  };

const seq = (orderNumber: string) => Number(orderNumber.split("-").pop());

async function main() {
  console.log("\nLogging in...");
  const asCashier = api(await login("cashier@berchi.com", "password123"));
  const asServer = api(await login("server1@berchi.com", "password123"));

  console.log("\n1. Reception takes a name and issues a number");
  const first = await asCashier("/api/orders", { method: "POST", body: JSON.stringify({ name: "  Abebe   Kebede " }) });
  check("ticket issued", first.status === 201, `status ${first.status}`);
  check("name is tidied", first.body?.walkInName === "Abebe Kebede", JSON.stringify(first.body?.walkInName));
  check("no customer record was created", first.body?.customer === null);

  const blank = await asCashier("/api/orders", { method: "POST", body: JSON.stringify({ name: "   " }) });
  check("a blank name is stored as no name", blank.status === 201 && blank.body?.walkInName === null);
  const wrongType = await asCashier("/api/orders", { method: "POST", body: JSON.stringify({ name: 42 }) });
  check("a non-text name is ignored", wrongType.status === 201 && wrongType.body?.walkInName === null);
  const tooLong = await asCashier("/api/orders", { method: "POST", body: JSON.stringify({ name: "x".repeat(150) }) });
  check("an over-long name is cut to 100", tooLong.body?.walkInName?.length === 100);
  const noName = await asCashier("/api/orders", { method: "POST", body: "{}" });
  check("a name is optional", noName.status === 201 && noName.body?.walkInName === null);

  console.log("\n2. The number shows who came first");
  const second = await asCashier("/api/orders", { method: "POST", body: JSON.stringify({ name: "Second Customer" }) });
  check("numbers rise in arrival order",
    seq(second.body.orderNumber) > seq(first.body.orderNumber),
    `${first.body?.orderNumber} then ${second.body?.orderNumber}`);
  const open = await asServer("/api/orders?open=true");
  const listed = (open.body as any[]).find((o) => o.id === first.body.id);
  check("stylists see the name on open tickets", listed?.walkInName === "Abebe Kebede");

  console.log("\n3. The name can be corrected later");
  const fixed = await asCashier(`/api/orders/${first.body.id}`, { method: "PATCH", body: JSON.stringify({ walkInName: "Abebe K." }) });
  check("name updated", fixed.status === 200 && fixed.body?.walkInName === "Abebe K.", `status ${fixed.status}`);
  const cleared = await asCashier(`/api/orders/${first.body.id}`, { method: "PATCH", body: JSON.stringify({ walkInName: "" }) });
  check("name can be cleared", cleared.status === 200 && cleared.body?.walkInName === null);
  await asCashier(`/api/orders/${first.body.id}`, { method: "PATCH", body: JSON.stringify({ walkInName: "Abebe Kebede" }) });

  console.log("\n4. The number slip");
  const slip = await fetch(`${BASE}/slip/${first.body.id}`, { headers: { Cookie: cookieHeader(await login("cashier@berchi.com", "password123")) } });
  const html = await slip.text();
  check("slip page opens for staff", slip.status === 200, `status ${slip.status}`);
  check("slip shows the short number large", html.includes(`>${seq(first.body.orderNumber)}<`), "short number missing");
  check("slip shows the full number", html.includes(first.body.orderNumber));
  check("slip shows the name", html.includes("Abebe Kebede"));
  check("slip is laid out 80mm wide", html.includes("width: 80mm"));
  const anon = await fetch(`${BASE}/slip/${first.body.id}`, { redirect: "manual" });
  check("slip needs a login", anon.status >= 300 && anon.status < 400, `status ${anon.status}`);
  const missing = await asCashier("/slip/00000000-0000-0000-0000-000000000000");
  check("unknown ticket is a 404", missing.status === 404, `status ${missing.status}`);

  console.log("\n5. Payment methods");
  const services = await asServer("/api/services");
  const serviceId = (services.body?.services ?? services.body)?.[0]?.id;
  check("found a service to sell", !!serviceId);

  async function payWith(method: string | undefined) {
    const t = await asCashier("/api/orders", { method: "POST", body: JSON.stringify({ name: `Pays ${method ?? "default"}` }) });
    await asServer(`/api/orders/${t.body.id}/items`, { method: "POST", body: JSON.stringify({ serviceId }) });
    await asServer(`/api/orders/${t.body.id}/send`, { method: "POST" });
    const body: any = {};
    if (method) body.paymentMethod = method;
    const paid = await asCashier(`/api/orders/${t.body.id}/checkout`, { method: "POST", body: JSON.stringify(body) });
    return { paid, ticket: t.body };
  }

  const cash = await payWith(undefined);
  check("no method chosen records CASH", cash.paid.status === 200 && cash.paid.body?.payment?.method === "CASH",
    `status ${cash.paid.status} ${JSON.stringify(cash.paid.body).slice(0, 120)}`);
  const mobile = await payWith("MOBILE");
  check("MOBILE is recorded", mobile.paid.body?.payment?.method === "MOBILE", JSON.stringify(mobile.paid.body).slice(0, 120));
  const bank = await payWith("BANK_TRANSFER");
  check("BANK_TRANSFER is recorded", bank.paid.body?.payment?.method === "BANK_TRANSFER", JSON.stringify(bank.paid.body).slice(0, 120));

  const receipt = await asCashier(`/api/invoices/${bank.paid.body.invoice.id}`);
  check("receipt carries the method", receipt.body?.payment?.method === "BANK_TRANSFER");
  check("receipt carries the customer's name", receipt.body?.order?.walkInName === "Pays BANK_TRANSFER", JSON.stringify(receipt.body?.order));

  for (const bad of ["CHAPA", "CARD", "BITCOIN"]) {
    const t = await asCashier("/api/orders", { method: "POST", body: "{}" });
    await asServer(`/api/orders/${t.body.id}/items`, { method: "POST", body: JSON.stringify({ serviceId }) });
    const res = await asCashier(`/api/orders/${t.body.id}/checkout`, { method: "POST", body: JSON.stringify({ paymentMethod: bad }) });
    check(`${bad} is refused`, res.status === 400, `status ${res.status}`);
    const stillOpen = await asCashier(`/api/orders/${t.body.id}`);
    check(`${bad} attempt leaves the ticket open`, stillOpen.body?.status !== "CHECKED_OUT");
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
