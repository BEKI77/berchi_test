import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: { items: true, products: true },
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

  const updated = await prisma.serviceOrder.update({
    where: { id: orderId },
    data: {
      status: "SENT_TO_CASHIER",
      completedAt: new Date(),
    },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true },
      },
      server: {
        select: { id: true, firstName: true, lastName: true },
      },
      items: {
        include: { service: { select: { id: true, name: true } } },
      },
      products: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(updated);
}
