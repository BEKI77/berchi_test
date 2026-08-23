import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asc, eq, not, inArray } from "drizzle-orm";
import { db } from "@/db";
import { staff, customers, appointments } from "@/db/schema";
import { fromBasisPoints } from "@/lib/money";

// GET: All employees with their stats for the owner employees overview page
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const staffList = await db
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
      .orderBy(asc(staff.createdAt));

    // Get SYSTEM_BLOCK customer IDs to exclude
    const systemBlockCustomers = await db.select({ id: customers.id })
      .from(customers)
      .where(eq(customers.lastName, "SYSTEM_BLOCK"));
    
    const systemBlockCustomerIds = systemBlockCustomers.map(c => c.id);

    // Get all service order items, orders, and commissions in bulk
    const [allOrders, allServiceItems, allCommissions, allAppointments] = await Promise.all([
      db.query.serviceOrders.findMany({
        columns: { id: true, serverId: true, status: true, startedAt: true, completedAt: true },
        with: {
          invoice: { columns: { totalAmount: true, tipAmount: true } },
        },
      }),
      db.query.serviceOrderItems.findMany({
        columns: { staffId: true, unitPrice: true, quantity: true },
        with: { service: { columns: { name: true } } },
      }),
      db.query.commissionLogs.findMany({
        columns: { staffId: true, commissionAmount: true },
      }),
      db.query.appointments.findMany({
        where: systemBlockCustomerIds.length > 0 ? 
          not(inArray(appointments.customerId, systemBlockCustomerIds)) : undefined,
        columns: { staffId: true, status: true },
      }),
    ]);

    // Build per-staff stats
    const employees = staffList.map((s) => {
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
        commissionRate: fromBasisPoints(s.commissionRate),
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
      totalEmployees: staffList.length,
      activeEmployees: staffList.filter((s) => s.isActive).length,
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
