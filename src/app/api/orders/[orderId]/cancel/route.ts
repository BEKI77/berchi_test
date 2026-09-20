import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { serviceOrders } from "@/db/schema";
import { EDITABLE_ORDER_STATUSES } from "@/lib/orders";
import { getSalonTimezone } from "@/lib/order-numbers";
import { publishOrderChange } from "@/lib/order-events";
import type { SessionUser } from "@/types";

// POST: Cancel a ticket that will not be paid -- a customer who left, or a slip
// issued by mistake. Most often used at closing, on tickets left open from
// earlier in the day or from a previous day.
//
// Needs orders.checkout, so cashiers and the owner can, but stylists cannot:
// cancelling a ticket with services on it writes off that money.
//
// The ticket is kept, marked CANCELLED, with a line in its notes saying who
// cancelled it and when, so a write-off is never silent.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasPermission(session.user.id, "orders.checkout"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const reason =
    typeof body?.reason === "string" ? body.reason.replace(/\s+/g, " ").trim().slice(0, 200) : "";

  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const timeZone = await getSalonTimezone();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); // YYYY-MM-DD
  const who = (session.user as SessionUser).firstName;
  const line = `Cancelled by ${who} on ${today}${reason ? `: ${reason}` : ""}`;

  // The status check is in the UPDATE itself, so a checkout that lands between
  // the read above and this write cannot be overwritten by a cancel.
  const [cancelled] = await db
    .update(serviceOrders)
    .set({
      status: "CANCELLED",
      completedAt: new Date(),
      notes: [order.notes, line].filter(Boolean).join("\n"),
    })
    .where(and(eq(serviceOrders.id, orderId), inArray(serviceOrders.status, [...EDITABLE_ORDER_STATUSES])))
    .returning({ id: serviceOrders.id, status: serviceOrders.status });

  if (!cancelled) {
    return NextResponse.json(
      { error: "This ticket has already been closed" },
      { status: 409 }
    );
  }

  publishOrderChange();
  return NextResponse.json(cancelled);
}
