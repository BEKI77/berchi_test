/**
 * A ticket stays editable from the moment reception opens it until the cashier
 * closes it. Sending to the cashier is a signal, not a lock: in a salon a
 * second stylist routinely adds a service after the first has already sent,
 * and the customer is still in the chair. Only checkout or cancellation ends
 * the ticket.
 */
export const EDITABLE_ORDER_STATUSES = ["IN_PROGRESS", "SENT_TO_CASHIER"] as const;

export function isOrderEditable(status: string): boolean {
  return (EDITABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

/** Relation tree shared by every endpoint that returns a full order. */
export const ORDER_WITH = {
  customer: { columns: { id: true, firstName: true, lastName: true, phone: true } },
  server: { columns: { id: true, firstName: true, lastName: true } },
  items: {
    with: {
      service: { with: { consumables: { with: { product: true } } } },
      staff: { columns: { id: true, firstName: true, lastName: true } },
      consumablesUsed: { with: { product: true } },
    },
  },
  products: { with: { product: true } },
  invoice: { with: { payment: true } },
} as const;

/** A ticket opened by reception has no customer until someone attaches one. */
export type CustomerLike = { firstName: string; lastName: string } | null | undefined;

/** Display name for a ticket's customer, or "Walk-in" when none is attached. */
export function customerName(c: CustomerLike): string {
  return c ? `${c.firstName} ${c.lastName}`.trim() : "Walk-in";
}

/** Avatar initials for a ticket's customer. */
export function customerInitials(c: CustomerLike): string {
  if (!c) return "W";
  return `${c.firstName?.[0] ?? ""}${c.lastName?.[0] ?? ""}` || "?";
}
