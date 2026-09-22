/**
 * What a ticket looks like on its way to a receipt printer.
 *
 * The desktop window (see `desktop/`) can print the number slip and the receipt
 * on a real thermal printer over ESC/POS, instead of printing a web page. These
 * are the shapes it expects; the two routes under `src/app/api/print/` fill them
 * in and `src/lib/desktop-print.ts` hands them over.
 *
 * Two decisions worth knowing about, both made here rather than in the desktop
 * program:
 *
 * - **Times arrive already written out.** The salon's timezone is a setting, and
 *   the whole system reads it from one place. Sending the words rather than an
 *   instant keeps the printed time identical to the screen it was printed from
 *   and saves the desktop program carrying a timezone database.
 * - **Money arrives as whole santim**, the integers the till computes in. It is
 *   turned into "1,840.00" on the printer side, by code that matches
 *   `formatMoney` exactly. Nothing monetary is ever a fraction; see
 *   `src/lib/money.ts`.
 */

import type { Santim } from "@/lib/money";

/** The salon's own details, as they head the ticket. */
export type TicketSalon = {
  name: string;
  address: string | null;
  phone: string | null;
  currency: string;
};

/** The number slip handed over at reception. */
export type SlipTicket = {
  salon: TicketSalon;
  /** The full ticket number, `ORD-20260922-0045`. */
  orderNumber: string;
  /** The tail of it, `45`, which is what people actually say. */
  shortNumber: string;
  customer: string | null;
  /** When they arrived, in the salon's timezone, already written out. */
  arrived: string | null;
};

/** One service or product on a receipt. */
export type TicketLine = {
  name: string;
  quantity: number;
  unitPrice: Santim;
  /** What this line adds to the bill. */
  amount: Santim;
};

/** How the customer paid. */
export type TicketPayment = {
  /** Already in words: "Cash", "Mobile money", "Bank transfer". */
  method: string;
  /**
   * Whether this was cash. The only thing that should kick the drawer open: a
   * card or transfer popping it is how a till loses count of its cash.
   */
  isCash: boolean;
  reference: string | null;
};

/** The receipt handed over at checkout. */
export type ReceiptTicket = {
  salon: TicketSalon;
  invoiceNumber: string;
  orderNumber: string | null;
  /** In the salon's timezone, already written out. */
  issued: string | null;
  customer: string | null;
  servedBy: string | null;

  services: TicketLine[];
  products: TicketLine[];

  subtotal: Santim;
  /** "Tax (15%)" -- worked out here, because the rate lives here. */
  taxLabel: string | null;
  taxAmount: Santim;
  discountLabel: string | null;
  discountAmount: Santim;
  tipAmount: Santim;
  total: Santim;

  payment: TicketPayment | null;
  /** "PAID". */
  status: string | null;
};

/**
 * A moment as the salon reads it: "22 Sep 2026, 14:32".
 *
 * The same format the printed slip page uses, so a ticket reprinted through the
 * browser and one printed on the receipt printer say the same thing.
 */
export function ticketMoment(when: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(when);
}
