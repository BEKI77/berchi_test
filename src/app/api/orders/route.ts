import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq, gte, desc, count as countFn, SQL } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders } from "@/db/schema";

// GET: List orders for the current server (or all for cashier/owner)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const serverId = searchParams.get("serverId");

  const conditions: SQL[] = [];
  if (status) {
    conditions.push(eq(serviceOrders.status, status as typeof serviceOrders.status.enumValues[number]));
  }
  if (serverId) {
    conditions.push(eq(serviceOrders.serverId, serverId));
  } else if (session.user.role === "SERVER") {
    conditions.push(eq(serviceOrders.serverId, session.user.id));
  }

  const orders = await db.query.serviceOrders.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      customer: { columns: { id: true, firstName: true, lastName: true, phone: true } },
      server: { columns: { id: true, firstName: true, lastName: true } },
      items: {
        with: { service: { columns: { id: true, name: true } } },
      },
      products: {
        with: { product: { columns: { id: true, name: true } } },
      },
      invoice: {
        with: { payment: true },
      },
    },
    orderBy: [desc(serviceOrders.createdAt)],
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
  const [{ value: orderCount }] = await db
    .select({ value: countFn() })
    .from(serviceOrders)
    .where(gte(serviceOrders.createdAt, new Date(today.getFullYear(), today.getMonth(), today.getDate())));
  const orderNumber = `ORD-${dateStr}-${String(Number(orderCount) + 1).padStart(4, "0")}`;

  const [order] = await db
    .insert(serviceOrders)
    .values({
      orderNumber,
      customerId,
      serverId: session.user.id,
      status: "IN_PROGRESS",
      notes,
    })
    .returning();

  // Re-fetch with relations
  const fullOrder = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, order.id),
    with: {
      customer: { columns: { id: true, firstName: true, lastName: true, phone: true } },
      server: { columns: { id: true, firstName: true, lastName: true } },
      items: true,
      products: true,
    },
  });

  return NextResponse.json(fullOrder, { status: 201 });
}
