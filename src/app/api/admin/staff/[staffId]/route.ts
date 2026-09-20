import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { staff, serviceOrders, serviceOrderItems, commissionLogs } from "@/db/schema";

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

    const [staffMember] = await db
      .select({
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        commissionRate: staff.commissionRate,
        isActive: staff.isActive,
        createdAt: staff.createdAt,
      })
      .from(staff)
      .where(eq(staff.id, staffId))
      .limit(1);

    if (!staffMember) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const [orders, serviceItems, commissions] = await Promise.all([
      db.query.serviceOrders.findMany({
        where: eq(serviceOrders.serverId, staffId),
        orderBy: [desc(serviceOrders.startedAt)],
        limit: 50,
        columns: { id: true, orderNumber: true, status: true, startedAt: true, completedAt: true, walkInName: true },
        with: {
          customer: { columns: { firstName: true, lastName: true } },
          items: {
            columns: { unitPrice: true, quantity: true },
            with: { service: { columns: { name: true } } },
          },
          products: {
            columns: { unitPrice: true, quantity: true },
            with: { product: { columns: { name: true } } },
          },
        },
      }),
      db.query.serviceOrderItems.findMany({
        where: eq(serviceOrderItems.staffId, staffId),
        columns: { unitPrice: true, quantity: true },
        with: { service: { columns: { name: true } } },
      }),
      db.query.commissionLogs.findMany({
        where: eq(commissionLogs.staffId, staffId),
        orderBy: [desc(commissionLogs.createdAt)],
        limit: 50,
        columns: { id: true, commissionRate: true, serviceAmount: true, commissionAmount: true, createdAt: true },
        with: {
          serviceOrderItem: {
            columns: {},
            with: {
              service: { columns: { name: true } },
              order: { columns: { orderNumber: true } },
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
      staff: staffMember,
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
