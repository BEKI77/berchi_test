import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders, serviceOrderItems, orderItemConsumables } from "@/db/schema";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string, itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId, itemId } = await params;
  const body = await req.json();
  const { consumables } = body; // Array of { productId, portionsUsed }

  if (!Array.isArray(consumables)) {
    return NextResponse.json({ error: "Consumables array is required" }, { status: 400 });
  }

  try {
    const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);
    if (!order || order.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Order not found or not editable" }, { status: 404 });
    }

    const [item] = await db.select().from(serviceOrderItems).where(eq(serviceOrderItems.id, itemId)).limit(1);
    if (!item) {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      // Clear existing recorded consumables for this item
      await tx.delete(orderItemConsumables).where(eq(orderItemConsumables.orderItemId, itemId));

      if (consumables.length > 0) {
        await tx.insert(orderItemConsumables).values(
          consumables.map((c: any) => ({
            orderItemId: itemId,
            productId: c.productId,
            portionsUsed: c.portionsUsed,
          }))
        );
      }

      return await tx.query.orderItemConsumables.findMany({
        where: eq(orderItemConsumables.orderItemId, itemId),
        with: { product: true },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to record consumables:", error);
    return NextResponse.json({ error: "Failed to record consumables" }, { status: 500 });
  }
}
