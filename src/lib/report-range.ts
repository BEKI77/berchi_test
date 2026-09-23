/**
 * Calendar-day ranges in the salon's own timezone.
 *
 * A report for "23 September" means 00:00 to 24:00 in Addis Ababa, not in UTC
 * and not in whatever timezone the server or the browser happens to run in.
 * Everything here works on YYYY-MM-DD keys and converts to instants only at
 * the edge, when a query needs them.
 */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Today's date in the given timezone, as YYYY-MM-DD. */
export function todayKey(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(at);
}

/** The date key n days after (or before, for negative n) the given one. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Milliseconds the timezone is ahead of UTC at the given instant. */
function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a calendar day begins in the given timezone. */
export function startOfDay(key: string, timeZone: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d);
  // Checked twice so a DST change on that day still lands on local midnight.
  const first = naive - offsetMs(timeZone, new Date(naive));
  return new Date(naive - offsetMs(timeZone, new Date(first)));
}

/** [start, end) instants covering the days from..to inclusive. */
export function dayRange(from: string, to: string, timeZone: string): { start: Date; end: Date } {
  return { start: startOfDay(from, timeZone), end: startOfDay(addDays(to, 1), timeZone) };
}
