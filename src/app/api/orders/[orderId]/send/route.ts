import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { serviceOrders } from "@/db/schema";
import { ORDER_WITH } from "@/lib/orders";
import { publishOrderChange } from "@/lib/order-events";

// POST: Flag a ticket as ready for the cashier.
//
// This is a signal, not a lock -- the ticket stays editable so a second stylist
// can still add work. Sending an already-sent ticket is harmless and simply
// refreshes it on the cashier screen, which is what staff expect when they tap
// the button twice.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.id, "orders.update"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;

  const order = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    with: { items: true, products: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "CHECKED_OUT") {
    return NextResponse.json({ error: "This ticket has already been paid" }, { status: 409 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "This ticket was cancelled" }, { status: 409 });
  }

  if (order.items.length === 0 && order.products.length === 0) {
    return NextResponse.json(
      { error: "Add at least one service or product before sending" },
      { status: 400 }
    );
  }

  await db
    .update(serviceOrders)
    .set({ status: "SENT_TO_CASHIER", completedAt: new Date() })
    .where(eq(serviceOrders.id, orderId));

  const updated = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    with: ORDER_WITH,
  });

  publishOrderChange();
  return NextResponse.json(updated);
}
