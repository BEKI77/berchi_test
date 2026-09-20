/* eslint-disable @typescript-eslint/no-explicit-any -- this harness parses arbitrary API JSON; typing each shape adds noise without catching bugs */
// Checks the live ticket stream end to end against a running server.
//
//   npm run test:sse            fast checks
//   npm run test:sse -- --slow  also waits out one 25s heartbeat
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SLOW = process.argv.includes("--slow");

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

// A listener that accumulates everything the stream sends, with timestamps.
async function openStream(jar: Map<string, string>) {
  const ctrl = new AbortController();
  const res = await fetch(`${BASE}/api/orders/events`, {
    headers: { Cookie: cookieHeader(jar) },
    signal: ctrl.signal,
  });
  const chunks: { at: number; text: string }[] = [];
  const decoder = new TextDecoder();
  (async () => {
    try {
      const reader = res.body!.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push({ at: Date.now(), text: decoder.decode(value) });
      }
    } catch {
      // aborted
    }
  })();

  const count = (needle: string) =>
    chunks.filter((c) => c.text.includes(needle)).length;

  // Resolves with how long it took for the n-th `changed` to arrive, or null.
  async function nextChange(before: number, timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (count("event: changed") > before) return Date.now() - start;
      await new Promise((r) => setTimeout(r, 10));
    }
    return null;
  }

  return { res, chunks, count, nextChange, close: () => ctrl.abort() };
}

async function main() {
  console.log("\nLogging in...");
  const serverJar = await login("server1@berchi.com", "password123");
  const cashierJar = await login("cashier@berchi.com", "password123");
  const asServer = api(serverJar);

  console.log("\n1. The stream is protected");
  const anon = await fetch(`${BASE}/api/orders/events`);
  check("no session is refused", anon.status === 401, `status ${anon.status}`);
  await anon.body?.cancel();

  console.log("\n2. The stream opens and is not buffered");
  const cashier = await openStream(cashierJar);
  check("status 200", cashier.res.status === 200, `status ${cashier.res.status}`);
  check(
    "content type is event-stream",
    (cashier.res.headers.get("content-type") ?? "").startsWith("text/event-stream"),
    cashier.res.headers.get("content-type") ?? ""
  );
  check(
    "not compressed (compression would buffer it)",
    !cashier.res.headers.get("content-encoding"),
    cashier.res.headers.get("content-encoding") ?? ""
  );
  await new Promise((r) => setTimeout(r, 300));
  check("first bytes arrive immediately", cashier.count("retry:") === 1,
    JSON.stringify(cashier.chunks));

  console.log("\n3. A change on the stylist's tablet reaches the cashier");
  let seen = cashier.count("event: changed");
  const created = await asServer("/api/orders", { method: "POST", body: "{}" });
  check("ticket created", created.status === 201, `status ${created.status}`);
  const t1 = await cashier.nextChange(seen);
  check("opening a ticket is announced", t1 !== null);
  if (t1 !== null) console.log(`     arrived in ${t1}ms`);

  const orderId = created.body?.id;
  const services = await asServer("/api/services");
  const serviceId = (services.body?.services ?? services.body)?.[0]?.id;
  check("found a service to add", !!serviceId, JSON.stringify(services.body).slice(0, 120));

  seen = cashier.count("event: changed");
  const added = await asServer(`/api/orders/${orderId}/items`, {
    method: "POST",
    body: JSON.stringify({ serviceId }),
  });
  check("service added", added.status === 201, `status ${added.status}`);
  const t2 = await cashier.nextChange(seen);
  check("adding a service is announced", t2 !== null);
  if (t2 !== null) console.log(`     arrived in ${t2}ms`);

  seen = cashier.count("event: changed");
  const sent = await asServer(`/api/orders/${orderId}/send`, { method: "POST" });
  check("ticket sent to cashier", sent.status === 200, `status ${sent.status}`);
  const t3 = await cashier.nextChange(seen);
  check("sending to the cashier is announced", t3 !== null);
  if (t3 !== null) console.log(`     arrived in ${t3}ms`);

  console.log("\n4. A refused change is not announced");
  seen = cashier.count("event: changed");
  const bad = await asServer(`/api/orders/${orderId}/items`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  check("bad request refused", bad.status === 400, `status ${bad.status}`);
  const quiet = await cashier.nextChange(seen, 600);
  check("nothing was broadcast", quiet === null);

  console.log("\n5. Several screens, and one leaving");
  const second = await openStream(cashierJar);
  const third = await openStream(cashierJar);
  await new Promise((r) => setTimeout(r, 200));
  third.close(); // a tablet going to sleep
  await new Promise((r) => setTimeout(r, 200));
  const s2 = cashier.count("event: changed");
  const s3 = second.count("event: changed");
  await asServer("/api/orders", { method: "POST", body: "{}" });
  const a = await cashier.nextChange(s2);
  const b = await second.nextChange(s3);
  check("every open screen is told", a !== null && b !== null);

  if (SLOW) {
    console.log("\n6. Heartbeat keeps an idle connection alive (waiting ~27s)");
    const idle = await openStream(cashierJar);
    await new Promise((r) => setTimeout(r, 27_000));
    check("keep-alive comment received", idle.count(": keep-alive") >= 1,
      JSON.stringify(idle.chunks));
    idle.close();
  }

  cashier.close();
  second.close();

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
