import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
  });

  if (!order || order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order not found or not editable" },
      { status: 404 }
    );
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const item = await prisma.serviceOrderItem.create({
    data: {
      orderId,
      serviceId,
      unitPrice: service.basePrice,
      quantity,
      staffId: session.user.id,
    },
    include: {
      service: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(item, { status: 201 });
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

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
  });

  if (!order || order.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Order not found or not editable" },
      { status: 404 }
    );
  }

  await prisma.serviceOrderItem.delete({ where: { id: itemId } });

  return NextResponse.json({ success: true });
}
