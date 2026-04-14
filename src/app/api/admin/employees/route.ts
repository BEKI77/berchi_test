import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: All employees with their stats for the owner employees overview page
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const staff = await prisma.staff.findMany({
      orderBy: { createdAt: "asc" },
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

    // Get all service order items, orders, and commissions in bulk
    const [allOrders, allServiceItems, allCommissions, allAppointments] = await Promise.all([
      prisma.serviceOrder.findMany({
        select: {
          id: true,
          serverId: true,
          status: true,
          startedAt: true,
          completedAt: true,
          invoice: {
            select: {
              totalAmount: true,
              tipAmount: true,
            },
          },
        },
      }),
      prisma.serviceOrderItem.findMany({
        select: {
          staffId: true,
          unitPrice: true,
          quantity: true,
          service: { select: { name: true } },
        },
      }),
      prisma.commissionLog.findMany({
        select: {
          staffId: true,
          commissionAmount: true,
        },
      }),
      prisma.appointment.findMany({
        select: {
          staffId: true,
          status: true,
        },
      }),
    ]);

    // Build per-staff stats
    const employees = staff.map((s) => {
      const orders = allOrders.filter((o) => o.serverId === s.id);
      const items = allServiceItems.filter((i) => i.staffId === s.id);
      const comms = allCommissions.filter((c) => c.staffId === s.id);
      const appts = allAppointments.filter((a) => a.staffId === s.id);

      const totalOrders = orders.length;
      const completedOrders = orders.filter((o) => o.status === "CHECKED_OUT").length;
      const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
      const inProgressOrders = orders.filter((o) => o.status === "IN_PROGRESS").length;

      const totalServiceRevenue = items.reduce(
        (sum, i) => sum + Number(i.unitPrice) * i.quantity, 0
      );
      const servicesPerformed = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalCommissions = comms.reduce(
        (sum, c) => sum + Number(c.commissionAmount), 0
      );

      // Revenue from invoices (actual paid)
      const totalInvoiceRevenue = orders.reduce((sum, o) => {
        if (o.invoice) return sum + Number(o.invoice.totalAmount);
        return sum;
      }, 0);
      const totalTipsEarned = orders.reduce((sum, o) => {
        if (o.invoice) return sum + Number(o.invoice.tipAmount);
        return sum;
      }, 0);

      // Appointments stats
      const totalAppointments = appts.length;
      const completedAppointments = appts.filter((a) => a.status === "COMPLETED").length;
      const cancelledAppointments = appts.filter((a) => a.status === "CANCELLED").length;
      const noShowAppointments = appts.filter((a) => a.status === "NO_SHOW").length;

      // Top services
      const serviceMap: Record<string, { count: number; revenue: number }> = {};
      items.forEach((item) => {
        const name = item.service.name;
        if (!serviceMap[name]) serviceMap[name] = { count: 0, revenue: 0 };
        serviceMap[name].count += item.quantity;
        serviceMap[name].revenue += Number(item.unitPrice) * item.quantity;
      });
      const topServices = Object.entries(serviceMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Avg revenue per order
      const avgRevenuePerOrder = completedOrders > 0
        ? totalInvoiceRevenue / completedOrders
        : 0;

      // Completion rate
      const completionRate = totalOrders > 0
        ? (completedOrders / totalOrders) * 100
        : 0;

      return {
        ...s,
        commissionRate: Number(s.commissionRate),
        stats: {
          totalOrders,
          completedOrders,
          cancelledOrders,
          inProgressOrders,
          totalServiceRevenue,
          servicesPerformed,
          totalCommissions,
          totalInvoiceRevenue,
          totalTipsEarned,
          avgRevenuePerOrder,
          completionRate,
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          noShowAppointments,
        },
        topServices,
      };
    });

    // Summary
    const summary = {
      totalEmployees: staff.length,
      activeEmployees: staff.filter((s) => s.isActive).length,
      totalRevenue: employees.reduce((s, e) => s + e.stats.totalInvoiceRevenue, 0),
      totalCommissions: employees.reduce((s, e) => s + e.stats.totalCommissions, 0),
      totalOrders: employees.reduce((s, e) => s + e.stats.totalOrders, 0),
      totalServicesPerformed: employees.reduce((s, e) => s + e.stats.servicesPerformed, 0),
      totalTips: employees.reduce((s, e) => s + e.stats.totalTipsEarned, 0),
    };

    return NextResponse.json({ employees, summary });
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}
