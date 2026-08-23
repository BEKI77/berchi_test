import { sql } from "drizzle-orm";
import { db } from "@/db";
import { documentCounters, salonSettings } from "@/db/schema";

/**
 * Either the root db handle or a transaction handle. Number allocation should
 * normally run inside the same transaction as the row it numbers, so that a
 * rolled-back order does not burn a sequence value.
 */
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Fallback when salon settings have not been configured yet. */
export const DEFAULT_TIMEZONE = "Africa/Addis_Ababa";

/**
 * Optional branch code, e.g. BOLE. Set this once per deployment. Without it,
 * two salons syncing into one cloud will mint identical order numbers.
 */
const SITE_CODE = process.env.SALON_SITE_CODE?.trim() || "";

/**
 * The calendar date in the salon's own timezone, as YYYYMMDD.
 *
 * This must not use toISOString(), which yields the UTC date. Addis Ababa is
 * UTC+3, so between 00:00 and 03:00 local the UTC date is still yesterday --
 * a ticket opened at 00:30 would be stamped with yesterday's date while the
 * daily counter had already reset, producing a duplicate order number.
 */
export function localDateKey(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);

  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}${part("month")}${part("day")}`;
}

/** Reads the configured salon timezone, falling back to Addis Ababa. */
export async function getSalonTimezone(client: DbOrTx = db): Promise<string> {
  const [settings] = await client.select().from(salonSettings).limit(1);
  return settings?.timezone || DEFAULT_TIMEZONE;
}

/**
 * Atomically claims the next value for a counter key.
 *
 * A single INSERT .. ON CONFLICT DO UPDATE .. RETURNING takes a row lock, so
 * concurrent callers serialise on it and each receives a distinct value. The
 * previous approach -- SELECT count(*) then add one -- handed the same number
 * to any two tablets that submitted at the same moment.
 */
export async function nextSequence(client: DbOrTx, key: string): Promise<number> {
  const [row] = await client
    .insert(documentCounters)
    .values({ key, lastSeq: 1 })
    .onConflictDoUpdate({
      target: documentCounters.key,
      set: { lastSeq: sql`${documentCounters.lastSeq} + 1` },
    })
    .returning({ lastSeq: documentCounters.lastSeq });

  return row.lastSeq;
}

function withSiteCode(base: string): string {
  return SITE_CODE ? `${SITE_CODE}-${base}` : base;
}

/** e.g. ORD-20260823-0001, or BOLE-ORD-20260823-0001 with a site code set. */
export async function nextOrderNumber(client: DbOrTx, timeZone: string): Promise<string> {
  const dateKey = localDateKey(timeZone);
  const seq = await nextSequence(client, `order:${dateKey}`);
  return withSiteCode(`ORD-${dateKey}-${String(seq).padStart(4, "0")}`);
}

/** e.g. INV-20260823-0001, or BOLE-INV-20260823-0001 with a site code set. */
export async function nextInvoiceNumber(client: DbOrTx, timeZone: string): Promise<string> {
  const dateKey = localDateKey(timeZone);
  const seq = await nextSequence(client, `invoice:${dateKey}`);
  return withSiteCode(`INV-${dateKey}-${String(seq).padStart(4, "0")}`);
}
