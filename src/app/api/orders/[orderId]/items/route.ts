import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders, services, serviceOrderItems } from "@/db/schema";

// POST: Add a service item to an order
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const body = await req.json();
  const { serviceId, quantity = 1 } = body;

  if (!serviceId) {
    return NextResponse.json({ error: "Service is required" }, { status: 400 });
  }

  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);

  if (!order || order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order not found or not editable" },
      { status: 404 }
    );
  }

  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const [item] = await db
    .insert(serviceOrderItems)
    .values({
      orderId,
      serviceId,
      unitPrice: service.basePrice,
      quantity,
      staffId: session.user.id,
    })
    .returning();

  // Re-fetch with service relation
  const fullItem = await db.query.serviceOrderItems.findFirst({
    where: eq(serviceOrderItems.id, item.id),
    with: { service: { columns: { id: true, name: true } } },
  });

  return NextResponse.json(fullItem, { status: 201 });
}

// DELETE: Remove a service item from an order
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);

  if (!order || order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order not found or not editable" },
      { status: 404 }
    );
  }

  await db.delete(serviceOrderItems).where(eq(serviceOrderItems.id, itemId));

  return NextResponse.json({ success: true });
}
