/**
 * How a customer can pay at the till. Every payment is confirmed by hand by the
 * cashier -- there is no online payment -- so this is a record of what the
 * customer handed over, used to reconcile the cash drawer at closing.
 *
 * Cash is first because it is the default and the most common.
 */
export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "MOBILE", label: "Mobile money" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
] as const;

export type ManualPaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const MANUAL_PAYMENT_METHODS: readonly string[] = PAYMENT_METHODS.map((m) => m.value);

/**
 * Label for any method stored in the database, including the two the till no
 * longer offers (CARD, CHAPA) so old invoices still read sensibly.
 */
export function paymentMethodLabel(method: string): string {
  const known = PAYMENT_METHODS.find((m) => m.value === method);
  if (known) return known.label;
  if (method === "CARD") return "Card";
  if (method === "CHAPA") return "Online (Chapa)";
  return method;
}
