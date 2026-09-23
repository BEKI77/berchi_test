/**
 * The shape of the order report, shared by /api/reports/orders and the page
 * that reads it. Money is integer santim throughout (see lib/money.ts).
 */

export type ReportPerson = { id: string; firstName: string; lastName: string };

export type ReportOrder = {
  id: string;
  orderNumber: string;
  status: "IN_PROGRESS" | "SENT_TO_CASHIER" | "CHECKED_OUT" | "CANCELLED";
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  customer: (ReportPerson & { phone: string | null }) | null;
  walkInName: string | null;
  server: ReportPerson | null;
  items: {
    id: string;
    serviceId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    staff: ReportPerson | null;
  }[];
  products: {
    id: string;
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }[];
  invoice: {
    id: string;
    invoiceNumber: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discountType: "PERCENTAGE" | "FIXED" | null;
    discountValue: number;
    discountAmount: number;
    tipAmount: number;
    totalAmount: number;
    status: "PENDING" | "PAID" | "REFUNDED" | "VOIDED";
    createdAt: string;
    payment: { method: string; amount: number; reference: string | null; createdAt: string } | null;
  } | null;
};

export type OrderReport = {
  timeZone: string;
  from: string;
  to: string;
  generatedAt: string;
  /** Every ticket still on the floor, whatever day it was opened. */
  active: ReportOrder[];
  /** Every ticket opened within from..to, in any status. */
  history: ReportOrder[];
  /** True when history hit the row cap and older tickets were left out. */
  truncated: boolean;
};

/** Services plus products, before tax, discount and tip. */
export function lineTotal(order: Pick<ReportOrder, "items" | "products">): number {
  const services = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const products = order.products.reduce((s, p) => s + p.unitPrice * p.quantity, 0);
  return services + products;
}

/** What the ticket is worth: the invoice total once billed, else its lines. */
export function orderValue(order: ReportOrder): number {
  return order.invoice ? order.invoice.totalAmount : lineTotal(order);
}

/** Money actually taken for the ticket: a paid invoice, nothing otherwise. */
export function paidAmount(order: ReportOrder): number {
  return order.invoice?.status === "PAID" ? order.invoice.totalAmount : 0;
}
