import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq, inArray, desc, SQL } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { serviceOrders } from "@/db/schema";
import type { OrderStatus } from "@/db/schema";
import { ORDER_WITH, EDITABLE_ORDER_STATUSES } from "@/lib/orders";
import { nextOrderNumber, getSalonTimezone, resolveOrderNumber } from "@/lib/order-numbers";
import { publishOrderChange } from "@/lib/order-events";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

// GET: Look up orders.
//
//   ?orderNumber=45                  today's ticket 45 (what staff type)
//   ?orderNumber=ORD-20260823-0045   exact ticket lookup
//   ?open=true                       tickets still on the floor
//   ?status=SENT_TO_CASHIER          single status
//   ?serverId=<uuid>                 tickets a given stylist worked on
//
// Tickets are shared: any stylist may look up any open ticket, because several
// of them serve the same customer against one number. Attribution lives on the
// individual line items, not on the ticket.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.id, "orders.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get("orderNumber");
  const status = searchParams.get("status");
  const serverId = searchParams.get("serverId");
  const open = searchParams.get("open");

  const conditions: SQL[] = [];

  if (orderNumber) {
    // Staff type "45", not the full number printed on the slip.
    const timeZone = await getSalonTimezone();
    conditions.push(eq(serviceOrders.orderNumber, resolveOrderNumber(orderNumber, timeZone)));
  }
  if (open === "true") {
    conditions.push(inArray(serviceOrders.status, [...EDITABLE_ORDER_STATUSES]));
  } else if (status) {
    conditions.push(eq(serviceOrders.status, status as OrderStatus));
  }
  if (serverId) {
    conditions.push(eq(serviceOrders.serverId, serverId));
  }

  const requested = Number(searchParams.get("limit"));
  const limit = Number.isFinite(requested) && requested > 0
    ? Math.min(requested, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const orders = await db.query.serviceOrders.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: ORDER_WITH,
    orderBy: [desc(serviceOrders.createdAt)],
    limit,
  });

  return NextResponse.json(orders);
}

// POST: Open a new ticket.
//
// A customer is optional. Reception issues a bare number when someone walks in,
// and identity gets attached later at the counter, or never -- most walk-ins
// never give a name, and forcing one was what pushed staff back to tracking
// people by name in the first place.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.id, "orders.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { customerId = null, notes = null } = body ?? {};

  const timeZone = await getSalonTimezone();

  // Number allocation and insert share a transaction, so a failed insert does
  // not leave a gap in the day's numbering.
  const order = await db.transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx, timeZone);

    const [created] = await tx
      .insert(serviceOrders)
      .values({
        orderNumber,
        customerId,
        serverId: session.user.id, // who opened it; not an ownership claim
        status: "IN_PROGRESS",
        notes,
      })
      .returning();

    return created;
  });

  const fullOrder = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, order.id),
    with: ORDER_WITH,
  });

  publishOrderChange();
  return NextResponse.json(fullOrder, { status: 201 });
}
