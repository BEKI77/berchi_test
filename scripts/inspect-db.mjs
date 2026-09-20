// Read-only look at a database's STRUCTURE and row counts, so a sync can be
// planned against what is really there.
//
//   PowerShell:  $env:INSPECT_DATABASE_URL = "postgres://user:pass@host:port/db"
//                node scripts/inspect-db.mjs
//
// Safe by design:
//  - The session is opened read-only, so the server refuses any write.
//  - It prints table names, row counts, column types, migration counts, enum
//    values and date ranges. It never prints row contents: no names, emails,
//    phone numbers or prices.
//  - The URL is read from the environment, never from a file, and never printed
//    (only host, port and database name are shown).
import postgres from "postgres";

const url = process.env.INSPECT_DATABASE_URL;
if (!url) {
  console.error("Set INSPECT_DATABASE_URL first (see the top of this file).");
  process.exit(1);
}

const u = new URL(url);
console.log("target:", `${u.hostname}:${u.port}`, u.pathname);

const sql = postgres(url, {
  prepare: false,
  connect_timeout: 15,
  max: 1,
  connection: { default_transaction_read_only: "on" },
});
const q = (text) => sql.unsafe(text);
const step = async (title, fn) => {
  try {
    await fn();
  } catch (e) {
    console.log(`[${title}] could not read:`, e.code || "", String(e.message).slice(0, 160));
  }
};

await step("connect", async () => {
  const [v] = await q(`select version() v, current_database() d, current_setting('default_transaction_read_only') ro`);
  console.log("server:", v.v.split(" ").slice(0, 2).join(" "), "| database:", v.d, "| read-only session:", v.ro);
});

await step("tables", async () => {
  const tables = (await q(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)).map((r) => r.table_name);
  console.log(`\ntables (${tables.length}) and row counts:`);
  const counts = [];
  for (const t of tables) {
    const [c] = await q(`select count(*)::int n from "${t}"`);
    counts.push(`${t}=${c.n}`);
  }
  console.log(counts.join("  "));
});

await step("migrations", async () => {
  const rows = await q(`select created_at from drizzle.__drizzle_migrations order by id`);
  console.log("\ndrizzle migrations applied:", rows.length);
});

await step("column types", async () => {
  const rows = await q(`select table_name||'.'||column_name c, data_type from information_schema.columns where table_schema='public' and (
    (table_name='services' and column_name='base_price') or
    (table_name='invoices' and column_name in ('total_amount','subtotal','tax_rate')) or
    (table_name='payments' and column_name='amount') or
    (table_name='staff' and column_name='commission_rate') or
    (table_name='salon_settings' and column_name='tax_rate') or
    (table_name='products' and column_name in ('sell_price','cost_price')) or
    (table_name='service_orders' and column_name='id')) order by 1`);
  console.log("\nkey column types (integer = current layout, numeric = older decimal layout, text = older Prisma layout):");
  console.log(rows.map((r) => `${r.c}:${r.data_type}`).join("  "));
});

await step("service_orders columns", async () => {
  const rows = await q(`select column_name from information_schema.columns where table_schema='public' and table_name='service_orders' order by ordinal_position`);
  console.log("\nservice_orders columns:", rows.map((r) => r.column_name).join(", "));
});

await step("enums", async () => {
  const rows = await q(`select t.typname n, array_agg(e.enumlabel order by e.enumsortorder) v from pg_type t join pg_enum e on t.oid=e.enumtypid group by 1 order by 1`);
  console.log("\nenums:", rows.map((r) => `${r.n}=[${r.v.join(",")}]`).join("  "));
});

await step("activity", async () => {
  const [o] = await q(`select count(*)::int n, min(created_at)::date first_day, max(created_at)::date last_day from service_orders`);
  console.log("\nservice_orders:", `${o.n} rows, from ${o.first_day} to ${o.last_day}`);
  const [i] = await q(`select count(*)::int n, min(created_at)::date first_day, max(created_at)::date last_day from invoices`);
  console.log("invoices:", `${i.n} rows, from ${i.first_day} to ${i.last_day}`);
});

await step("roles", async () => {
  const roles = await q(`select role, count(*)::int n from staff group by 1 order by 1`);
  console.log("\nstaff by role:", roles.map((r) => `${r.role}=${r.n}`).join("  "));
  const [p] = await q(`select (select count(*)::int from permissions) permissions, (select count(*)::int from roles) roles, (select count(*)::int from role_permissions) role_permissions`);
  console.log("permissions tables:", JSON.stringify(p));
});

await sql.end();
