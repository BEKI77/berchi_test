import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders } from "@/db/schema";

// POST: Send order to cashier
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;

  const order = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    with: { items: true, products: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order has already been sent or completed" },
      { status: 400 }
    );
  }

  if (order.items.length === 0) {
    return NextResponse.json(
      { error: "Order must have at least one service" },
      { status: 400 }
    );
  }

  await db
    .update(serviceOrders)
    .set({ status: "SENT_TO_CASHIER", completedAt: new Date() })
    .where(eq(serviceOrders.id, orderId));

  const updated = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    with: {
      customer: { columns: { id: true, firstName: true, lastName: true } },
      server: { columns: { id: true, firstName: true, lastName: true } },
      items: {
        with: { service: { columns: { id: true, name: true } } },
      },
      products: {
        with: { product: { columns: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(updated);
}
