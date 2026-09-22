import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { invoices, salonSettings } from "@/db/schema";
import { DEFAULT_TIMEZONE } from "@/lib/order-numbers";
import { ticketName } from "@/lib/orders";
import { formatPercent } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { ticketMoment, type ReceiptTicket, type TicketLine } from "@/lib/tickets";

/**
 * The receipt, ready for a receipt printer.
 *
 * The same figures the receipt screen shows, as data instead, so the desktop
 * window can print them over ESC/POS. Everything monetary stays an integer
 * number of santim the whole way; only the printer turns it into "1,840.00".
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.id, "billing.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { invoiceId } = await params;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: {
        order: {
          columns: { orderNumber: true, walkInName: true },
          with: {
            customer: { columns: { firstName: true, lastName: true } },
            server: { columns: { firstName: true, lastName: true } },
            items: {
              columns: { unitPrice: true, quantity: true },
              with: { service: { columns: { name: true } } },
            },
            products: {
              columns: { unitPrice: true, quantity: true },
              with: { product: { columns: { name: true } } },
            },
          },
        },
        payment: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    const [settings] = await db.select().from(salonSettings).limit(1);
    const timeZone = settings?.timezone || DEFAULT_TIMEZONE;

    const line = (name: string, unitPrice: number, quantity: number): TicketLine => ({
      name,
      quantity,
      unitPrice,
      amount: unitPrice * quantity,
    });

    const served = invoice.order.server;
    const customer = ticketName({
      customer: invoice.order.customer,
      walkInName: invoice.order.walkInName,
    });

    const ticket: ReceiptTicket = {
      salon: {
        name: settings?.salonName ?? "Berchi Salon",
        address: settings?.address ?? null,
        phone: settings?.phone ?? null,
        currency: settings?.currency ?? "ETB",
      },
      invoiceNumber: invoice.invoiceNumber,
      orderNumber: invoice.order.orderNumber,
      issued: ticketMoment(invoice.createdAt, timeZone),
      customer,
      servedBy: served ? `${served.firstName} ${served.lastName}`.trim() : null,

      services: invoice.order.items.map((item) =>
        line(item.service.name, item.unitPrice, item.quantity)
      ),
      products: invoice.order.products.map((product) =>
        line(product.product.name, product.unitPrice, product.quantity)
      ),

      subtotal: invoice.subtotal,
      // Only worth a line when there is tax to show. A "Tax 0.00" line on every
      // receipt in a salon that charges none is just noise.
      taxLabel: invoice.taxAmount ? `Tax (${formatPercent(invoice.taxRate)})` : null,
      taxAmount: invoice.taxAmount,
      discountLabel: discountLabel(invoice.discountType, invoice.discountValue),
      discountAmount: invoice.discountAmount,
      tipAmount: invoice.tipAmount,
      total: invoice.totalAmount,

      payment: invoice.payment
        ? {
            method: paymentMethodLabel(invoice.payment.method),
            isCash: invoice.payment.method === "CASH",
            reference: invoice.payment.reference,
          }
        : null,
      status: invoice.status,
    };

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Failed to build the receipt ticket:", error);
    return NextResponse.json({ error: "Failed to build the receipt" }, { status: 500 });
  }
}

/**
 * "Discount (10%)" for a percentage off, plain "Discount" for an amount.
 *
 * The percentage is worth printing because it is the part a customer queries;
 * repeating a fixed amount that is already in the right-hand column is not.
 */
function discountLabel(type: string | null, value: number): string | null {
  if (type === "PERCENTAGE" && value > 0) {
    return `Discount (${formatPercent(value)})`;
  }
  return "Discount";
}
