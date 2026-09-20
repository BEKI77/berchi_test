import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { serviceOrders, products, serviceOrderProducts } from "@/db/schema";
import { isOrderEditable } from "@/lib/orders";
import { publishOrderChange } from "@/lib/order-events";

// POST: Add a retail product to a ticket.
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
  const { productId, quantity = 1, orderItemId = null } = body ?? {};

  if (!productId) {
    return NextResponse.json({ error: "Product is required" }, { status: 400 });
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

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // A retail line for this product already on the ticket merges with the new
  // quantity. Lines attached to a service are kept separate from loose ones.
  const [existing] = await db
    .select()
    .from(serviceOrderProducts)
    .where(
      and(
        eq(serviceOrderProducts.orderId, orderId),
        eq(serviceOrderProducts.productId, productId),
        orderItemId
          ? eq(serviceOrderProducts.orderItemId, orderItemId)
          : isNull(serviceOrderProducts.orderItemId)
      )
    )
    .limit(1);

  // Check stock against the resulting total, not just the increment.
  const resultingQuantity = (existing?.quantity ?? 0) + quantity;
  if (product.quantityOnHand < resultingQuantity) {
    return NextResponse.json(
      { error: `Only ${product.quantityOnHand} in stock` },
      { status: 400 }
    );
  }

  let orderProductId: string;
  if (existing) {
    const [updated] = await db
      .update(serviceOrderProducts)
      .set({ quantity: resultingQuantity })
      .where(eq(serviceOrderProducts.id, existing.id))
      .returning();
    orderProductId = updated.id;
  } else {
    const [created] = await db
      .insert(serviceOrderProducts)
      .values({
        orderId,
        orderItemId,
        productId,
        quantity,
        unitPrice: product.sellPrice, // retail sale, not the cost price
      })
      .returning();
    orderProductId = created.id;
  }

  const orderProduct = await db.query.serviceOrderProducts.findFirst({
    where: eq(serviceOrderProducts.id, orderProductId),
    with: { product: { columns: { id: true, name: true } } },
  });

  publishOrderChange();
  return NextResponse.json(orderProduct, { status: 201 });
}

// DELETE: Remove a retail product line from a ticket.
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
  const productItemId = searchParams.get("productItemId");

  if (!productItemId) {
    return NextResponse.json({ error: "Product item ID is required" }, { status: 400 });
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

  const deleted = await db
    .delete(serviceOrderProducts)
    .where(
      and(
        eq(serviceOrderProducts.id, productItemId),
        eq(serviceOrderProducts.orderId, orderId)
      )
    )
    .returning({ id: serviceOrderProducts.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Product not found on this ticket" }, { status: 404 });
  }

  publishOrderChange();
  return NextResponse.json({ success: true });
}
