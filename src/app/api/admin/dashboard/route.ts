import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq, gte, count as countFn } from "drizzle-orm";
import { db } from "@/db";
import {
  serviceOrders, invoices, staff, customers,
  services, products,
} from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      todaysOrders,
      allInvoices,
      [{ value: activeStaff }],
      [{ value: totalCustomers }],
      [{ value: totalServices }],
      allActiveProducts,
    ] = await Promise.all([
      db.query.serviceOrders.findMany({
        where: gte(serviceOrders.startedAt, todayStart),
        with: {
          items: true,
          products: true,
          server: { columns: { firstName: true, lastName: true } },
        },
      }),
      db
        .select({ totalAmount: invoices.totalAmount, tipAmount: invoices.tipAmount })
        .from(invoices)
        .where(and(gte(invoices.createdAt, todayStart), eq(invoices.status, "PAID"))),
      db.select({ value: countFn() }).from(staff).where(eq(staff.isActive, true)),
      db.select({ value: countFn() }).from(customers),
      db.select({ value: countFn() }).from(services).where(eq(services.isActive, true)),
      db
        .select({ quantityOnHand: products.quantityOnHand, reorderLevel: products.reorderLevel })
        .from(products)
        .where(eq(products.isActive, true)),
    ]);

    const lowStockProducts = allActiveProducts.filter(
      (p) => p.quantityOnHand <= p.reorderLevel
    ).length;

    const todaysRevenue = allInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0
    );
    const todaysTips = allInvoices.reduce(
      (sum, inv) => sum + Number(inv.tipAmount),
      0
    );
    const clientsServed = todaysOrders.filter(
      (o) => o.status === "CHECKED_OUT"
    ).length;
    const servicesDone = todaysOrders.reduce(
      (sum, o) => sum + o.items.length,
      0
    );

    // Top server today
    const serverCounts: Record<string, { name: string; count: number }> = {};
    todaysOrders
      .filter((o) => o.status === "CHECKED_OUT")
      .forEach((o) => {
        const key = o.serverId;
        if (!serverCounts[key]) {
          serverCounts[key] = {
            name: `${o.server.firstName} ${o.server.lastName}`,
            count: 0,
          };
        }
        serverCounts[key].count++;
      });
    const topServer = Object.values(serverCounts).sort(
      (a, b) => b.count - a.count
    )[0] || null;

    return NextResponse.json({
      todaysRevenue,
      todaysTips,
      clientsServed,
      servicesDone,
      activeStaff: Number(activeStaff),
      totalCustomers: Number(totalCustomers),
      totalServices: Number(totalServices),
      lowStockProducts,
      transactionCount: allInvoices.length,
      topServer,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
