import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { serviceOrders, serviceOrderItems, orderItemConsumables } from "@/db/schema";
import { isOrderEditable } from "@/lib/orders";

type ConsumableInput = { productId?: unknown; portionsUsed?: unknown };

// POST: Record which stock a stylist actually used on one service line.
// Replaces whatever was previously recorded for that line.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.id, "orders.update"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId, itemId } = await params;
  const body = await req.json().catch(() => ({}));
  const consumables: ConsumableInput[] = body?.consumables;

  if (!Array.isArray(consumables)) {
    return NextResponse.json({ error: "Consumables array is required" }, { status: 400 });
  }

  for (const entry of consumables) {
    if (!entry?.productId) {
      return NextResponse.json({ error: "Each consumable needs a product" }, { status: 400 });
    }
    if (!Number.isInteger(entry.portionsUsed) || (entry.portionsUsed as number) < 1) {
      return NextResponse.json(
        { error: "Portions used must be a whole number of 1 or more" },
        { status: 400 }
      );
    }
  }

  try {
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

    // The line must belong to the ticket named in the URL.
    const [item] = await db
      .select()
      .from(serviceOrderItems)
      .where(and(eq(serviceOrderItems.id, itemId), eq(serviceOrderItems.orderId, orderId)))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Service line not found on this ticket" }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      await tx.delete(orderItemConsumables).where(eq(orderItemConsumables.orderItemId, itemId));

      if (consumables.length > 0) {
        await tx.insert(orderItemConsumables).values(
          consumables.map((c) => ({
            orderItemId: itemId,
            productId: c.productId as string,
            portionsUsed: c.portionsUsed as number,
          }))
        );
      }

      return tx.query.orderItemConsumables.findMany({
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
