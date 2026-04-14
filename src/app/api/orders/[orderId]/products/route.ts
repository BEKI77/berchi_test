import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders, products, serviceOrderProducts } from "@/db/schema";

// POST: Add a product to an order
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
  const { productId, quantity = 1 } = body;

  if (!productId) {
    return NextResponse.json({ error: "Product is required" }, { status: 400 });
  }

  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);

  if (!order || order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order not found or not editable" },
      { status: 404 }
    );
  }

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product.quantityOnHand < quantity) {
    return NextResponse.json(
      { error: `Only ${product.quantityOnHand} units available` },
      { status: 400 }
    );
  }

  // Check if product already exists in this order
  const [existing] = await db
    .select()
    .from(serviceOrderProducts)
    .where(and(eq(serviceOrderProducts.orderId, orderId), eq(serviceOrderProducts.productId, productId)))
    .limit(1);

  let orderProductId: string;
  if (existing) {
    const [updated] = await db
      .update(serviceOrderProducts)
      .set({ quantity: existing.quantity + quantity })
      .where(eq(serviceOrderProducts.id, existing.id))
      .returning();
    orderProductId = updated.id;
  } else {
    const [created] = await db
      .insert(serviceOrderProducts)
      .values({
        orderId,
        productId,
        quantity,
        unitPrice: product.usagePrice,
      })
      .returning();
    orderProductId = created.id;
  }

  const orderProduct = await db.query.serviceOrderProducts.findFirst({
    where: eq(serviceOrderProducts.id, orderProductId),
    with: { product: { columns: { id: true, name: true } } },
  });

  return NextResponse.json(orderProduct, { status: 201 });
}

// DELETE: Remove a product from an order
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
  const productItemId = searchParams.get("productItemId");

  if (!productItemId) {
    return NextResponse.json({ error: "Product item ID is required" }, { status: 400 });
  }

  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);

  if (!order || order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order not found or not editable" },
      { status: 404 }
    );
  }

  await db.delete(serviceOrderProducts).where(eq(serviceOrderProducts.id, productItemId));

  return NextResponse.json({ success: true });
}
