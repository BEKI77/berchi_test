import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, desc, gte, inArray, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders } from "@/db/schema";
import { hasPermission } from "@/lib/permissions";
import { EDITABLE_ORDER_STATUSES } from "@/lib/orders";
import { getSalonTimezone } from "@/lib/order-numbers";
import { addDays, dayRange, isDateKey, todayKey } from "@/lib/report-range";
import type { OrderReport, ReportOrder } from "@/lib/order-report";

const MAX_DAYS = 366;
const MAX_HISTORY_ROWS = 5000;

const person = { columns: { id: true, firstName: true, lastName: true } } as const;

// Only what the report shows. ORDER_WITH also loads every service's consumable
// recipe, which a year of history does not need.
const REPORT_WITH = {
  customer: { columns: { id: true, firstName: true, lastName: true, phone: true } },
  server: person,
  items: {
    columns: { id: true, serviceId: true, unitPrice: true, quantity: true },
    with: { service: { columns: { name: true } }, staff: person },
  },
  products: {
    columns: { id: true, productId: true, unitPrice: true, quantity: true },
    with: { product: { columns: { name: true } } },
  },
  invoice: {
    with: { payment: { columns: { method: true, amount: true, reference: true, createdAt: true } } },
  },
} as const;

type Row = Awaited<ReturnType<typeof findOrders>>[number];

function findOrders(where: SQL | undefined, limit?: number) {
  return db.query.serviceOrders.findMany({
    where,
    columns: {
      id: true, orderNumber: true, status: true, notes: true,
      startedAt: true, completedAt: true, walkInName: true,
    },
    with: REPORT_WITH,
    orderBy: [desc(serviceOrders.startedAt)],
    limit,
  });
}

function toReportOrder(o: Row): ReportOrder {
  const inv = o.invoice;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    notes: o.notes,
    startedAt: o.startedAt.toISOString(),
    completedAt: o.completedAt?.toISOString() ?? null,
    customer: o.customer,
    walkInName: o.walkInName,
    server: o.server,
    items: o.items.map((i) => ({
      id: i.id,
      serviceId: i.serviceId,
      name: i.service?.name ?? "Service",
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      staff: i.staff,
    })),
    products: o.products.map((p) => ({
      id: p.id,
      productId: p.productId,
      name: p.product?.name ?? "Product",
      unitPrice: p.unitPrice,
      quantity: p.quantity,
    })),
    invoice: inv
      ? {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          subtotal: inv.subtotal,
          taxRate: inv.taxRate,
          taxAmount: inv.taxAmount,
          discountType: inv.discountType,
          discountValue: inv.discountValue,
          discountAmount: inv.discountAmount,
          tipAmount: inv.tipAmount,
          totalAmount: inv.totalAmount,
          status: inv.status,
          createdAt: inv.createdAt.toISOString(),
          payment: inv.payment
            ? {
                method: inv.payment.method,
                amount: inv.payment.amount,
                reference: inv.payment.reference,
                createdAt: inv.payment.createdAt.toISOString(),
              }
            : null,
        }
      : null,
  };
}

// GET: The order report for the cashier and the owner.
//
//   ?from=2026-09-01&to=2026-09-23   days in the salon's timezone, inclusive
//
// Both default to today. History is every ticket opened in the range, in any
// status, so a ticket belongs to the day printed on its slip. Active tickets
// are returned whatever day they were opened: one left open since yesterday is
// exactly what the cashier needs to see.
//
// Needs billing.view, because the report shows what was paid. Stylists have
// orders.view but not billing.view, and keep their own history screen.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasPermission(session.user.id, "billing.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timeZone = await getSalonTimezone();
  const today = todayKey(timeZone);

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  if ((fromParam && !isDateKey(fromParam)) || (toParam && !isDateKey(toParam))) {
    return NextResponse.json({ error: "Dates must be YYYY-MM-DD" }, { status: 400 });
  }

  let from = fromParam || toParam || today;
  let to = toParam || fromParam || today;
  if (from > to) [from, to] = [to, from];
  if (from < addDays(to, -(MAX_DAYS - 1))) {
    return NextResponse.json({ error: `The range can be at most ${MAX_DAYS} days` }, { status: 400 });
  }

  const { start, end } = dayRange(from, to, timeZone);

  const [activeRows, historyRows] = await Promise.all([
    findOrders(inArray(serviceOrders.status, [...EDITABLE_ORDER_STATUSES])),
    findOrders(and(gte(serviceOrders.startedAt, start), lt(serviceOrders.startedAt, end)), MAX_HISTORY_ROWS + 1),
  ]);

  const truncated = historyRows.length > MAX_HISTORY_ROWS;

  const report: OrderReport = {
    timeZone,
    from,
    to,
    generatedAt: new Date().toISOString(),
    active: activeRows.map(toReportOrder),
    history: historyRows.slice(0, MAX_HISTORY_ROWS).map(toReportOrder),
    truncated,
  };

  return NextResponse.json(report);
}
