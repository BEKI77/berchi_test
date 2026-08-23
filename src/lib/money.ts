/**
 * Money handling for the till.
 *
 * Every monetary value is stored and computed as an integer number of santim
 * (1/100 of an ETB). Nothing monetary is ever held in a JS float, because
 * float arithmetic does not represent tenths exactly: 0.1 + 0.2 is
 * 0.30000000000000004, and a day of those errors shows up as a gap between
 * the till total and the cash in the drawer.
 *
 * Rates (tax, commission) are integer basis points -- hundredths of a percent,
 * so 15% is 1500. That keeps rate arithmetic in integers too.
 */

/** An integer number of santim. 1840.00 ETB is 184000. */
export type Santim = number;

/** An integer number of basis points. 15% is 1500, 7.5% is 750. */
export type BasisPoints = number;

/** Parses user input or a legacy decimal string into santim. */
export function toSantim(value: string | number | null | undefined): Santim {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Santim as a plain number of ETB. For display only -- never for arithmetic. */
export function fromSantim(santim: Santim): number {
  return santim / 100;
}

/** "1,840.00" -- grouped, always two decimals. */
export function formatMoney(santim: Santim): string {
  const negative = santim < 0;
  const abs = Math.abs(Math.round(santim));
  const birr = Math.floor(abs / 100);
  const cents = abs % 100;
  const grouped = birr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${cents.toString().padStart(2, "0")}`;
}

/** "ETB 1,840.00" */
export function formatMoneyWithCurrency(santim: Santim, currency = "ETB"): string {
  return `${currency} ${formatMoney(santim)}`;
}

/** Parses a percentage from input or a legacy decimal string into basis points. */
export function toBasisPoints(percent: string | number | null | undefined): BasisPoints {
  if (percent === null || percent === undefined || percent === "") return 0;
  const n = typeof percent === "number" ? percent : Number(percent);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Basis points as a percentage number, e.g. 1500 -> 15. */
export function fromBasisPoints(bp: BasisPoints): number {
  return bp / 100;
}

/** "15%" or "7.5%" -- trailing zeros trimmed. */
export function formatPercent(bp: BasisPoints): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : Number(pct.toFixed(2))}%`;
}

/**
 * Applies a rate to an amount, rounding half away from zero.
 *
 * Kept in integers throughout: 184000 santim at 1500bp is
 * 184000 * 1500 / 10000 = 27600 santim exactly.
 */
export function applyRate(amount: Santim, bp: BasisPoints): Santim {
  const product = amount * bp;
  const sign = product < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(product) / 10000);
}

/** Sums santim amounts. Exact, unlike a float reduce. */
export function sumSantim(values: Santim[]): Santim {
  return values.reduce((total, v) => total + v, 0);
}
