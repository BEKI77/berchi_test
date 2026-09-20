import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { serviceOrders } from "@/db/schema";
import { ORDER_WITH, isOrderEditable, cleanWalkInName } from "@/lib/orders";
import { publishOrderChange } from "@/lib/order-events";

// GET: One ticket, by id.
//
// Previously the order screen fetched every order in the system with its full
// relation tree and picked one out client-side, which got slower with every
// ticket the salon ever wrote.
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

  const { orderId } = await params;

  const order = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    with: ORDER_WITH,
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

// PATCH: Attach a customer, or edit notes, on an open ticket.
//
// This is how a walk-in ticket acquires a name -- usually at the counter, once
// the customer is paying and happy to give one.
export async function PATCH(
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

  const [order] = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.id, orderId))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!isOrderEditable(order.status)) {
    return NextResponse.json(
      { error: "This ticket has been closed and can no longer be changed" },
      { status: 409 }
    );
  }

  const updates: { customerId?: string | null; notes?: string | null; walkInName?: string | null } = {};
  if ("customerId" in body) updates.customerId = body.customerId ?? null;
  if ("notes" in body) updates.notes = body.notes ?? null;
  if ("walkInName" in body) updates.walkInName = cleanWalkInName(body.walkInName);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(serviceOrders).set(updates).where(eq(serviceOrders.id, orderId));

  const updated = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    with: ORDER_WITH,
  });

  publishOrderChange();
  return NextResponse.json(updated);
}
