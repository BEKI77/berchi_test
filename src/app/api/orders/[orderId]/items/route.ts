import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { serviceOrders, services, serviceOrderItems, staff } from "@/db/schema";
import { isOrderEditable } from "@/lib/orders";
import { publishOrderChange } from "@/lib/order-events";

// POST: Add a service line to a ticket.
//
// Any stylist with orders.update may add to any open ticket -- that is the
// whole point of numbering tickets instead of tracking customers by name.
// Credit for the work goes to staffId on the line, which defaults to the
// caller but may name another stylist (the cashier adding a forgotten service).
export async function POST(
  req: Request,
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
  const body = await req.json().catch(() => ({}));
  const { serviceId, quantity = 1, staffId } = body ?? {};

  if (!serviceId) {
    return NextResponse.json({ error: "Service is required" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Quantity must be a whole number of 1 or more" }, { status: 400 });
  }

  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!isOrderEditable(order.status)) {
    return NextResponse.json(
      { error: "This ticket has been closed and can no longer be changed" },
      { status: 409 }
    );
  }

  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const creditedTo = staffId ?? session.user.id;
  if (staffId && staffId !== session.user.id) {
    const [target] = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, staffId)).limit(1);
    if (!target) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
  }

  const [item] = await db
    .insert(serviceOrderItems)
    .values({
      orderId,
      serviceId,
      unitPrice: service.basePrice,
      quantity,
      staffId: creditedTo,
    })
    .returning();

  const fullItem = await db.query.serviceOrderItems.findFirst({
    where: eq(serviceOrderItems.id, item.id),
    with: {
      service: { columns: { id: true, name: true } },
      staff: { columns: { id: true, firstName: true, lastName: true } },
    },
  });

  publishOrderChange();
  return NextResponse.json(fullItem, { status: 201 });
}

// DELETE: Remove a service line from a ticket.
export async function DELETE(
  req: Request,
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
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!isOrderEditable(order.status)) {
    return NextResponse.json(
      { error: "This ticket has been closed and can no longer be changed" },
      { status: 409 }
    );
  }

  // Scope the delete to this order, so an item id from another ticket cannot
  // be removed through this route.
  const deleted = await db
    .delete(serviceOrderItems)
    .where(and(eq(serviceOrderItems.id, itemId), eq(serviceOrderItems.orderId, orderId)))
    .returning({ id: serviceOrderItems.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Item not found on this ticket" }, { status: 404 });
  }

  publishOrderChange();
  return NextResponse.json({ success: true });
}
