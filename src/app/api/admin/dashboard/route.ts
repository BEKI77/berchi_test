import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      activeStaff,
      totalCustomers,
      totalServices,
      allActiveProducts,
    ] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: { startedAt: { gte: todayStart } },
        include: {
          items: true,
          products: true,
          server: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { createdAt: { gte: todayStart }, status: "PAID" },
        select: { totalAmount: true, tipAmount: true },
      }),
      prisma.staff.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.service.count({ where: { isActive: true } }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { quantityOnHand: true, reorderLevel: true },
      }),
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
      activeStaff,
      totalCustomers,
      totalServices,
      lowStockProducts,
      transactionCount: allInvoices.length,
      topServer,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
