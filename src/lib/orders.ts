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

/**
 * What every screen needs in order to name a ticket. walkInName has no `?` on
 * purpose: a screen whose order type forgets it fails to compile, instead of
 * quietly showing "Walk-in" for a customer who gave a name.
 */
export type NamedTicket = {
  customer: { firstName: string; lastName: string } | null | undefined;
  walkInName: string | null;
};

/**
 * Who a ticket is for. A registered customer wins; otherwise the name given at
 * reception; otherwise "Walk-in", because a name is asked for but not forced.
 */
export function ticketName(t: NamedTicket): string {
  if (t.customer) return `${t.customer.firstName} ${t.customer.lastName}`.trim();
  return t.walkInName?.trim() || "Walk-in";
}

const MAX_WALK_IN_NAME = 100;

/** Tidies a name typed at reception: trimmed, one space between words, or null if blank. */
export function cleanWalkInName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim().slice(0, MAX_WALK_IN_NAME);
  return name || null;
}

/** Avatar initials for a ticket. */
export function ticketInitials(t: NamedTicket): string {
  if (t.customer) {
    return `${t.customer.firstName?.[0] ?? ""}${t.customer.lastName?.[0] ?? ""}` || "?";
  }
  const name = t.walkInName?.trim();
  return name ? name.slice(0, 2).toUpperCase() : "W";
}

/**
 * The trailing sequence, which is what staff actually say and write on the
 * slip. ORD-20260823-0045 reads as "45".
 */
export function shortOrderNumber(orderNumber: string): string {
  const tail = orderNumber.split("-").pop() ?? orderNumber;
  return String(Number(tail) || tail);
}
