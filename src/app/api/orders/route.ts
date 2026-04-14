import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: List orders for the current server (or all for cashier/owner)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const serverId = searchParams.get("serverId");

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  if (serverId) {
    where.serverId = serverId;
  } else if (session.user.role === "SERVER") {
    where.serverId = session.user.id;
  }

  const orders = await prisma.serviceOrder.findMany({
    where,
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      server: {
        select: { id: true, firstName: true, lastName: true },
      },
      items: {
        include: {
          service: {
            select: { id: true, name: true },
          },
        },
      },
      products: {
        include: {
          product: {
            select: { id: true, name: true },
          },
        },
      },
      invoice: {
        include: {
          payment: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

// POST: Create a new service order
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "SERVER" && session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { customerId, notes } = body;

  if (!customerId) {
    return NextResponse.json(
      { error: "Customer is required" },
      { status: 400 }
    );
  }

  // Generate order number: ORD-YYYYMMDD-XXXX
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.serviceOrder.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      },
    },
  });
  const orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(4, "0")}`;

  const order = await prisma.serviceOrder.create({
    data: {
      orderNumber,
      customerId,
      serverId: session.user.id,
      status: "IN_PROGRESS",
      notes,
    },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      server: {
        select: { id: true, firstName: true, lastName: true },
      },
      items: true,
      products: true,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
