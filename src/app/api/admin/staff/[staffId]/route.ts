import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { staffId } = await params;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        commissionRate: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const [orders, serviceItems, commissions] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: { serverId: staffId },
        orderBy: { startedAt: "desc" },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          startedAt: true,
          completedAt: true,
          customer: { select: { firstName: true, lastName: true } },
          items: {
            select: {
              unitPrice: true,
              quantity: true,
              service: { select: { name: true } },
            },
          },
          products: {
            select: {
              unitPrice: true,
              quantity: true,
              product: { select: { name: true } },
            },
          },
        },
      }),
      prisma.serviceOrderItem.findMany({
        where: { staffId },
        select: {
          unitPrice: true,
          quantity: true,
          service: { select: { name: true } },
        },
      }),
      prisma.commissionLog.findMany({
        where: { staffId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          commissionRate: true,
          serviceAmount: true,
          commissionAmount: true,
          createdAt: true,
          serviceOrderItem: {
            select: {
              service: { select: { name: true } },
              order: { select: { orderNumber: true } },
            },
          },
        },
      }),
    ]);

    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === "CHECKED_OUT").length;
    const totalServiceRevenue = serviceItems.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity, 0
    );
    const totalCommissions = commissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount), 0
    );
    const servicesPerformed = serviceItems.reduce((sum, i) => sum + i.quantity, 0);

    // Service breakdown
    const serviceMap: Record<string, { count: number; revenue: number }> = {};
    serviceItems.forEach((item) => {
      const name = item.service.name;
      if (!serviceMap[name]) serviceMap[name] = { count: 0, revenue: 0 };
      serviceMap[name].count += item.quantity;
      serviceMap[name].revenue += Number(item.unitPrice) * item.quantity;
    });
    const serviceBreakdown = Object.entries(serviceMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      staff,
      stats: {
        totalOrders,
        completedOrders,
        totalServiceRevenue,
        totalCommissions,
        servicesPerformed,
      },
      serviceBreakdown,
      recentOrders: orders.slice(0, 20),
      recentCommissions: commissions,
    });
  } catch (error) {
    console.error("Failed to fetch staff detail:", error);
    return NextResponse.json({ error: "Failed to fetch staff detail" }, { status: 500 });
  }
}
