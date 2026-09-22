import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { salonSettings, serviceOrders } from "@/db/schema";
import { DEFAULT_TIMEZONE } from "@/lib/order-numbers";
import { shortOrderNumber, ticketName } from "@/lib/orders";
import { ticketMoment, type SlipTicket } from "@/lib/tickets";

/**
 * The number slip, ready for a receipt printer.
 *
 * The same ticket `/slip/[orderId]` renders as a web page, as data instead: the
 * desktop window asks for this and prints it over ESC/POS. Assembled on the
 * server, not in the browser, for two reasons -- the salon's timezone and
 * letterhead live here, and the cashier's own permission to see a ticket is
 * checked here rather than being taken on trust from a page.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.id, "orders.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { orderId } = await params;

    const order = await db.query.serviceOrders.findFirst({
      where: eq(serviceOrders.id, orderId),
      columns: { orderNumber: true, walkInName: true, startedAt: true },
      with: { customer: { columns: { firstName: true, lastName: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const [settings] = await db.select().from(salonSettings).limit(1);
    const timeZone = settings?.timezone || DEFAULT_TIMEZONE;

    // "Walk-in" is what the screen shows when nobody gave a name, but on the
    // slip it is noise: the number is the point, and a line saying "Walk-in"
    // only crowds it.
    const named = ticketName({ customer: order.customer, walkInName: order.walkInName });

    const ticket: SlipTicket = {
      salon: {
        name: settings?.salonName ?? "Berchi Salon",
        address: settings?.address ?? null,
        phone: settings?.phone ?? null,
        currency: settings?.currency ?? "ETB",
      },
      orderNumber: order.orderNumber,
      shortNumber: shortOrderNumber(order.orderNumber),
      customer: named === "Walk-in" ? null : named,
      arrived: ticketMoment(order.startedAt, timeZone),
    };

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Failed to build the slip ticket:", error);
    return NextResponse.json({ error: "Failed to build the slip" }, { status: 500 });
  }
}
