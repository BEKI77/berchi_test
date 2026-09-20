/* eslint-disable @typescript-eslint/no-explicit-any -- this harness parses arbitrary API JSON; typing each shape adds noise without catching bugs */
// Checks the shared-tablet PIN sign-in end to end against a running server that
// has ENABLE_PIN_LOGIN=true.
//
//   npm run test:pin
//
// It writes to the database directly for a few checks (lock expiry, a PIN on a
// non-stylist), so it refuses to run against anything but a local database.
import "dotenv/config";
import postgres from "postgres";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const dbUrl = new URL(process.env.DATABASE_URL ?? "postgres://none@nowhere/x");
if (!["localhost", "127.0.0.1", "::1"].includes(dbUrl.hostname)) {
  console.error(`Refusing to run: DATABASE_URL points at ${dbUrl.hostname}, not a local database.`);
  process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 2 });

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
const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function callback(provider: string, fields: Record<string, string>) {
  const jar = new Map<string, string>();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  mergeCookies(jar, csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/${provider}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader(jar) },
    body: new URLSearchParams({ ...fields, csrfToken, redirect: "false" }),
    redirect: "manual",
  });
  mergeCookies(jar, res);
  const where = new URL(res.headers.get("location") ?? "/", BASE);
  return {
    jar,
    signedIn: jar.has("authjs.session-token"),
    error: where.searchParams.get("error"),
    code: where.searchParams.get("code"),
  };
}
const pinLogin = (staffId: string, pin: string) => callback("pin", { staffId, pin });
const passwordLogin = (email: string, password: string) => callback("credentials", { email, password });

const api = (jar: Map<string, string>) =>
  async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      redirect: "manual",
      ...init,
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar), ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : text; } catch { body = text; }
    return { status: res.status, body, text };
  };

async function main() {
  console.log("\nLogging in as the owner...");
  const owner = await passwordLogin("owner@berchi.com", "password123");
  const asOwner = api(owner.jar);
  const asCashier = api((await passwordLogin("cashier@berchi.com", "password123")).jar);

  const staff = (await asOwner("/api/staff")).body as any[];
  const idOf = (email: string) => staff.find((s) => s.email === email)?.id as string;
  const hana = idOf("server1@berchi.com");
  const liya = idOf("server2@berchi.com");
  const meron = idOf("cashier@berchi.com");
  check("found the demo stylists and cashier", !!hana && !!liya && !!meron);

  const setPin = (id: string, pin: string) => asOwner(`/api/staff/${id}`, { method: "PATCH", body: JSON.stringify({ pin }) });

  console.log("\n1. The owner sets PINs");
  for (const weak of ["0000", "1111", "1234", "4321", "12", "abcd", "12345", " 2468"]) {
    const r = await setPin(hana, weak);
    check(`refuses "${weak}"`, r.status === 400, `status ${r.status}`);
  }
  const cashierPin = await setPin(meron, "2468");
  check("a PIN cannot be set for a cashier", cashierPin.status === 400, `status ${cashierPin.status}`);
  const byCashier = await asCashier(`/api/staff/${hana}`, { method: "PATCH", body: JSON.stringify({ pin: "2468" }) });
  check("only the owner can set a PIN", byCashier.status === 403, `status ${byCashier.status}`);

  const set1 = await setPin(hana, "2468");
  const set2 = await setPin(liya, "1357");
  check("owner sets a stylist's PIN (PIN alone, no other fields)", set1.status === 200 && set1.body?.hasPin === true, `status ${set1.status}`);
  check("...and the response never contains a hash", !/pin_?hash|\$2[aby]\$/i.test(set1.text), set1.text);
  check("second stylist set", set2.status === 200);
  const list = await asOwner("/api/staff");
  check("staff list says who has a PIN", (list.body as any[]).find((s) => s.id === hana)?.hasPin === true);
  check("...and never contains a hash", !/pin_?hash|\$2[aby]\$/i.test(list.text));

  console.log("\n2. The name list on the tablet");
  const names = await fetch(`${BASE}/api/tablet/staff`);
  const namesText = await names.text();
  const namesBody = JSON.parse(namesText);
  check("opens with no login", names.status === 200, `status ${names.status}`);
  check("says how long a PIN is", namesBody.pinLength === 4);
  check("lists the stylists who have a PIN", namesBody.staff.some((s: any) => s.id === hana) && namesBody.staff.some((s: any) => s.id === liya));
  check("does not list the cashier or the owner", !namesBody.staff.some((s: any) => s.id === meron));
  check("gives no emails or other details", !namesText.includes("@") && Object.keys(namesBody.staff[0]).sort().join() === "id,locked,name",
    Object.keys(namesBody.staff[0]).join());
  check("shows a first name and last initial", /^[A-Z][a-z]+ [A-Z]\.$/.test(namesBody.staff.find((s: any) => s.id === hana)?.name ?? ""),
    namesBody.staff.find((s: any) => s.id === hana)?.name);

  console.log("\n3. Signing in with a PIN");
  const ok = await pinLogin(hana, "2468");
  check("the right PIN signs in", ok.signedIn && !ok.error, JSON.stringify({ e: ok.error, c: ok.code }));
  const asHana = api(ok.jar);
  const session = (await asHana("/api/auth/session")).body;
  check("session is that stylist", session?.user?.id === hana && session?.user?.role === "SERVER", JSON.stringify(session));
  check("session is marked as a PIN session", session?.user?.signedInWith === "pin", JSON.stringify(session?.user));
  const orders = await asHana("/api/orders?open=true");
  check("stylist screens work", orders.status === 200, `status ${orders.status}`);
  const ghost = "00000000-0000-0000-0000-000000000000";
  check("but checkout is refused", (await asHana(`/api/orders/${ghost}/checkout`, { method: "POST", body: "{}" })).status === 403);
  check("cancelling a ticket is refused", (await asHana(`/api/orders/${ghost}/cancel`, { method: "POST", body: "{}" })).status === 403);
  check("admin reports are refused", [401, 403].includes((await asHana("/api/admin/reports")).status));
  check("changing staff is refused", (await asHana(`/api/staff/${hana}`, { method: "PATCH", body: JSON.stringify({ role: "OWNER" }) })).status === 403);
  const password = await passwordLogin("server1@berchi.com", "password123");
  const passSession = (await api(password.jar)("/api/auth/session")).body;
  check("an email sign-in is not marked as a PIN session", passSession?.user?.signedInWith === "password", JSON.stringify(passSession?.user));

  console.log("\n4. Wrong PINs lock the stylist out");
  const codes: string[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await pinLogin(hana, "9753");
    codes.push(`${r.code}${r.signedIn ? "+session" : ""}`);
  }
  check("tries left count down, then it locks", codes.join() === "pin_wrong_4,pin_wrong_3,pin_wrong_2,pin_wrong_1,pin_locked", codes.join());
  const locked = await pinLogin(hana, "2468");
  check("even the right PIN is refused while locked", !locked.signedIn && locked.code === "pin_locked", JSON.stringify({ s: locked.signedIn, c: locked.code }));
  const nowNames = (await (await fetch(`${BASE}/api/tablet/staff`)).json()).staff;
  check("the tablet shows that stylist as locked", nowNames.find((s: any) => s.id === hana)?.locked === true);
  check("other stylists are unaffected", nowNames.find((s: any) => s.id === liya)?.locked === false);
  check("...and can still sign in", (await pinLogin(liya, "1357")).signedIn);

  console.log("\n5. A lockout runs out");
  await sql`update staff_pin_attempts set locked_until = '2000-01-01' where staff_id = ${hana}`;
  const after = await pinLogin(hana, "2468");
  check("the right PIN works once the lock has expired", after.signedIn, JSON.stringify({ c: after.code }));
  const [row] = await sql`select failed_count, locked_until from staff_pin_attempts where staff_id = ${hana}`;
  check("...and the count starts again", row?.failed_count === 0 && row?.locked_until === null, JSON.stringify(row));
  const fresh = await pinLogin(hana, "9753");
  check("a wrong PIN after that has the full tries again", fresh.code === "pin_wrong_4", String(fresh.code));

  console.log("\n6. The owner can unlock by setting a new PIN");
  for (let i = 0; i < 4; i++) await pinLogin(hana, "9753"); // 4 more wrong: locks
  check("locked again", (await pinLogin(hana, "2468")).code === "pin_locked");
  await setPin(hana, "8642");
  check("the old PIN no longer works", (await pinLogin(hana, "2468")).code === "pin_wrong_4");
  check("the new PIN works, so the lock is gone", (await pinLogin(hana, "8642")).signedIn);
  await setPin(hana, "2468");

  console.log("\n7. Many guesses at once cannot beat the limit");
  const burst = await Promise.all(Array.from({ length: 12 }, () => pinLogin(liya, "9753")));
  const wrongs = burst.filter((r) => r.code?.startsWith("pin_wrong_")).length;
  const lockedCount = burst.filter((r) => r.code === "pin_locked").length;
  check("at most 4 wrong guesses were answered, the rest hit the lock", wrongs === 4 && lockedCount === 8, `wrong=${wrongs} locked=${lockedCount}`);
  check("none got in", burst.every((r) => !r.signedIn));
  await setPin(liya, "1357");

  console.log("\n8. Only stylists, only active, only well-formed");
  await sql`update staff set pin_hash = (select pin_hash from staff where id = ${hana}) where id = ${meron}`;
  const cashierTry = await pinLogin(meron, "2468");
  check("a cashier is refused even if a PIN is forced into the database", !cashierTry.signedIn, JSON.stringify({ c: cashierTry.code }));
  await sql`update staff set pin_hash = null where id = ${meron}`;

  await asOwner(`/api/staff/${liya}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
  const gone = (await (await fetch(`${BASE}/api/tablet/staff`)).json()).staff;
  check("a deactivated stylist leaves the list", !gone.some((s: any) => s.id === liya));
  check("...and cannot sign in", !(await pinLogin(liya, "1357")).signedIn);
  await asOwner(`/api/staff/${liya}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
  check("reactivated, they can again", (await pinLogin(liya, "1357")).signedIn);

  for (const [staffId, pin, what] of [["not-a-uuid", "2468", "a bad id"], [hana, "24", "a short PIN"], [hana, "abcd", "letters"], [hana, "24681", "a long PIN"]] as const) {
    const r = await pinLogin(staffId, pin);
    check(`${what} is refused`, !r.signedIn && !r.code?.startsWith("pin_"), JSON.stringify({ c: r.code }));
  }
  const [counted] = await sql`select failed_count from staff_pin_attempts where staff_id = ${hana}`;
  check("malformed attempts do not count against the stylist", !counted || counted.failed_count === 0, JSON.stringify(counted));

  console.log("\n9. Removing a PIN");
  const removed = await asOwner(`/api/staff/${liya}`, { method: "PATCH", body: JSON.stringify({ clearPin: true }) });
  check("owner can remove a PIN", removed.status === 200 && removed.body?.hasPin === false, `status ${removed.status}`);
  check("that stylist leaves the tablet list", !(await (await fetch(`${BASE}/api/tablet/staff`)).json()).staff.some((s: any) => s.id === liya));
  check("...and cannot sign in with the old PIN", !(await pinLogin(liya, "1357")).signedIn);
  await setPin(liya, "1357"); // leave the demo data as the seed leaves it

  await sql.end();
  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await sql.end().catch(() => {});
  process.exit(1);
});
