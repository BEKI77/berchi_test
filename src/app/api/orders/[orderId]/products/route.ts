import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
  });

  if (!order || order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order not found or not editable" },
      { status: 404 }
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

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
  const existing = await prisma.serviceOrderProduct.findFirst({
    where: { orderId, productId },
  });

  let orderProduct;
  if (existing) {
    orderProduct = await prisma.serviceOrderProduct.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
      include: { product: { select: { id: true, name: true } } },
    });
  } else {
    orderProduct = await prisma.serviceOrderProduct.create({
      data: {
        orderId,
        productId,
        quantity,
        unitPrice: product.usagePrice,
      },
      include: { product: { select: { id: true, name: true } } },
    });
  }

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

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
  });

  if (!order || order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order not found or not editable" },
      { status: 404 }
    );
  }

  await prisma.serviceOrderProduct.delete({ where: { id: productItemId } });

  return NextResponse.json({ success: true });
}
