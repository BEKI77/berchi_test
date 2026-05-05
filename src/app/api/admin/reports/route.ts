import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, not, inArray } from "drizzle-orm";
import { db } from "@/db";
import { staff, customers, appointments } from "@/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Custom date range
    const rangeFrom = fromParam ? new Date(fromParam + "T00:00:00") : null;
    const rangeTo = toParam ? new Date(toParam + "T23:59:59") : null;

    // Get SYSTEM_BLOCK customer IDs to exclude
    const systemBlockCustomers = await db.select({ id: customers.id })
      .from(customers)
      .where(eq(customers.lastName, "SYSTEM_BLOCK"));
    
    const systemBlockCustomerIds = systemBlockCustomers.map(c => c.id);

    // Parallel queries
    const [
      allInvoices,
      allOrders,
      allExpenses,
      staffMembers,
      allServiceItems,
      allProductItems,
      customersList,
      appointmentsList,
    ] = await Promise.all([
      db.query.invoices.findMany({
        columns: {
          totalAmount: true, tipAmount: true, taxAmount: true,
          discountAmount: true, subtotal: true, status: true, createdAt: true,
        },
        with: { payment: { columns: { method: true } } },
      }),
      db.query.serviceOrders.findMany({
        columns: { id: true, status: true, startedAt: true, serverId: true, completedAt: true },
      }),
      db.query.expenses.findMany({
        columns: { amount: true, category: true, date: true, description: true, status: true },
      }),
      db.query.staff.findMany({
        where: eq(staff.isActive, true),
        columns: { id: true, firstName: true, lastName: true, role: true, commissionRate: true },
      }),
      db.query.serviceOrderItems.findMany({
        columns: { unitPrice: true, quantity: true, staffId: true },
        with: {
          service: {
            columns: { id: true, name: true },
            with: { category: { columns: { name: true } } },
          },
          order: { columns: { startedAt: true } },
        },
      }),
      db.query.serviceOrderProducts.findMany({
        columns: { unitPrice: true, quantity: true },
        with: {
          product: { columns: { id: true, name: true } },
          order: { columns: { startedAt: true } },
        },
      }),
      db.query.customers.findMany({
        columns: { id: true, createdAt: true },
      }),
      db.query.appointments.findMany({
        where: systemBlockCustomerIds.length > 0 ? 
          not(inArray(appointments.customerId, systemBlockCustomerIds)) : undefined,
        columns: { id: true, status: true, source: true, startTime: true },
      }),
    ]);

    // Helper: filter by custom range
    const inRange = (d: Date) => {
      if (rangeFrom && d < rangeFrom) return false;
      if (rangeTo && d > rangeTo) return false;
      return true;
    };

    // === ALL-TIME METRICS ===
    const paidInvoices = allInvoices.filter((i) => i.status === "PAID");
    const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalTips = paidInvoices.reduce((s, i) => s + Number(i.tipAmount), 0);
    const totalTax = paidInvoices.reduce((s, i) => s + Number(i.taxAmount), 0);
    const totalDiscounts = paidInvoices.reduce((s, i) => s + Number(i.discountAmount), 0);
    const totalExpensesAll = allExpenses.filter((e) => e.status === "PAID").reduce((s, e) => s + Number(e.amount), 0);

    // === RANGE-FILTERED METRICS ===
    const rangePaid = rangeFrom
      ? paidInvoices.filter((i) => inRange(new Date(i.createdAt)))
      : paidInvoices;
    const rangeRevenue = rangePaid.reduce((s, i) => s + Number(i.totalAmount), 0);
    const rangeTips = rangePaid.reduce((s, i) => s + Number(i.tipAmount), 0);
    const rangeTax = rangePaid.reduce((s, i) => s + Number(i.taxAmount), 0);
    const rangeDiscounts = rangePaid.reduce((s, i) => s + Number(i.discountAmount), 0);
    const rangeExpenses = rangeFrom
      ? allExpenses.filter((e) => e.status === "PAID" && inRange(new Date(e.date))).reduce((s, e) => s + Number(e.amount), 0)
      : totalExpensesAll;
    const rangeSubtotal = rangePaid.reduce((s, i) => s + Number(i.subtotal), 0);
    const avgTransactionValue = rangePaid.length > 0 ? rangeRevenue / rangePaid.length : 0;

    // This month / last month
    const thisMonthRevenue = paidInvoices
      .filter((i) => new Date(i.createdAt) >= thisMonthStart)
      .reduce((s, i) => s + Number(i.totalAmount), 0);
    const lastMonthRevenue = paidInvoices
      .filter((i) => { const d = new Date(i.createdAt); return d >= lastMonthStart && d <= lastMonthEnd; })
      .reduce((s, i) => s + Number(i.totalAmount), 0);
    const todayRevenue = paidInvoices
      .filter((i) => new Date(i.createdAt) >= todayStart)
      .reduce((s, i) => s + Number(i.totalAmount), 0);

    // === DAILY REVENUE ===
    const days = rangeFrom && rangeTo
      ? Math.min(Math.ceil((rangeTo.getTime() - rangeFrom.getTime()) / 86400000) + 1, 90)
      : 30;
    const startDate = rangeFrom || new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const dailyRevenue: { date: string; revenue: number; orders: number; tips: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const dayStr = d.toISOString().split("T")[0];
      const dayInv = paidInvoices.filter((inv) => {
        const c = new Date(inv.createdAt);
        return c >= d && c < dayEnd;
      });
      dailyRevenue.push({
        date: dayStr,
        revenue: dayInv.reduce((s, inv) => s + Number(inv.totalAmount), 0),
        orders: dayInv.length,
        tips: dayInv.reduce((s, inv) => s + Number(inv.tipAmount), 0),
      });
    }

    // === BUSIEST HOURS ===
    const hourBuckets: Record<number, { count: number; revenue: number }> = {};
    rangePaid.forEach((inv) => {
      const h = new Date(inv.createdAt).getHours();
      if (!hourBuckets[h]) hourBuckets[h] = { count: 0, revenue: 0 };
      hourBuckets[h].count++;
      hourBuckets[h].revenue += Number(inv.totalAmount);
    });
    const busiestHours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`,
      count: hourBuckets[h]?.count || 0,
      revenue: hourBuckets[h]?.revenue || 0,
    })).filter((h) => h.count > 0);

    // === PAYMENT METHOD BREAKDOWN ===
    const paymentMethods: Record<string, { count: number; amount: number }> = {};
    rangePaid.forEach((inv) => {
      const method = inv.payment?.method || "UNKNOWN";
      if (!paymentMethods[method]) paymentMethods[method] = { count: 0, amount: 0 };
      paymentMethods[method].count++;
      paymentMethods[method].amount += Number(inv.totalAmount);
    });

    // === STAFF PERFORMANCE ===
    const rangeOrders = rangeFrom
      ? allOrders.filter((o) => inRange(new Date(o.startedAt)))
      : allOrders;
    const rangeServiceItems = rangeFrom
      ? allServiceItems.filter((i) => inRange(new Date(i.order.startedAt)))
      : allServiceItems;

    const staffPerformance = staffMembers
      .filter((s) => s.role === "SERVER")
      .map((s) => {
        const staffOrders = rangeOrders.filter((o) => o.serverId === s.id);
        const staffItems = rangeServiceItems.filter((i) => i.staffId === s.id);
        const serviceRevenue = staffItems.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
        const commissionEarned = serviceRevenue * (Number(s.commissionRate) / 100);
        return {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          totalOrders: staffOrders.length,
          completedOrders: staffOrders.filter((o) => o.status === "CHECKED_OUT").length,
          serviceRevenue,
          servicesPerformed: staffItems.reduce((sum, i) => sum + i.quantity, 0),
          commissionRate: Number(s.commissionRate),
          commissionEarned,
        };
      })
      .sort((a, b) => b.serviceRevenue - a.serviceRevenue);

    // === ALL SERVICES (not just top 10) ===
    const serviceMap: Record<string, { name: string; category: string; count: number; revenue: number }> = {};
    rangeServiceItems.forEach((item) => {
      const key = item.service.id;
      if (!serviceMap[key]) serviceMap[key] = { name: item.service.name, category: item.service.category?.name || "Uncategorized", count: 0, revenue: 0 };
      serviceMap[key].count += item.quantity;
      serviceMap[key].revenue += Number(item.unitPrice) * item.quantity;
    });
    const allServicesData = Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue);

    // === SERVICE CATEGORY BREAKDOWN ===
    const categoryMap: Record<string, { count: number; revenue: number }> = {};
    allServicesData.forEach((s) => {
      if (!categoryMap[s.category]) categoryMap[s.category] = { count: 0, revenue: 0 };
      categoryMap[s.category].count += s.count;
      categoryMap[s.category].revenue += s.revenue;
    });
    const serviceCategories = Object.entries(categoryMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // === ALL PRODUCTS ===
    const rangeProductItems = rangeFrom
      ? allProductItems.filter((i) => inRange(new Date(i.order.startedAt)))
      : allProductItems;
    const productMap: Record<string, { name: string; count: number; revenue: number }> = {};
    rangeProductItems.forEach((item) => {
      const key = item.product.id;
      if (!productMap[key]) productMap[key] = { name: item.product.name, count: 0, revenue: 0 };
      productMap[key].count += item.quantity;
      productMap[key].revenue += Number(item.unitPrice) * item.quantity;
    });
    const allProductsData = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

    // === EXPENSE BREAKDOWN ===
    const rangeExpensesList = rangeFrom
      ? allExpenses.filter((e) => e.status === "PAID" && inRange(new Date(e.date)))
      : allExpenses.filter((e) => e.status === "PAID");
    const expenseByCategory: Record<string, number> = {};
    rangeExpensesList.forEach((e) => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
    });
    const thisMonthExpenses = allExpenses
      .filter((e) => e.status === "PAID" && new Date(e.date) >= thisMonthStart)
      .reduce((s, e) => s + Number(e.amount), 0);

    // === CUSTOMER INSIGHTS ===
    const rangeCustomers = rangeFrom
      ? customersList.filter((c) => inRange(new Date(c.createdAt)))
      : customersList;
    const newCustomersThisMonth = customersList.filter((c) => new Date(c.createdAt) >= thisMonthStart).length;

    // === APPOINTMENT INSIGHTS ===
    const rangeAppointments = rangeFrom
      ? appointmentsList.filter((a) => inRange(new Date(a.startTime)))
      : appointmentsList;
    const appointmentStats = {
      total: rangeAppointments.length,
      confirmed: rangeAppointments.filter((a) => a.status === "CONFIRMED").length,
      completed: rangeAppointments.filter((a) => a.status === "COMPLETED").length,
      cancelled: rangeAppointments.filter((a) => a.status === "CANCELLED").length,
      noShow: rangeAppointments.filter((a) => a.status === "NO_SHOW").length,
      online: rangeAppointments.filter((a) => a.source === "ONLINE").length,
      manual: rangeAppointments.filter((a) => a.source === "MANUAL").length,
    };

    // === ORDER STATS ===
    const orderStats = {
      total: rangeOrders.length,
      completed: rangeOrders.filter((o) => o.status === "CHECKED_OUT").length,
      inProgress: rangeOrders.filter((o) => o.status === "IN_PROGRESS").length,
      sent: rangeOrders.filter((o) => o.status === "SENT_TO_CASHIER").length,
      cancelled: rangeOrders.filter((o) => o.status === "CANCELLED").length,
    };

    return NextResponse.json({
      overview: {
        totalRevenue,
        totalTips,
        totalTax,
        totalDiscounts,
        totalExpenses: totalExpensesAll,
        netProfit: totalRevenue - totalExpensesAll,
        todayRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        revenueGrowth: lastMonthRevenue > 0
          ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
          : 0,
        totalOrders: allOrders.length,
        completedOrders: allOrders.filter((o) => o.status === "CHECKED_OUT").length,
        totalCustomers: customersList.length,
        newCustomersThisMonth,
        totalInvoices: paidInvoices.length,
      },
      rangeMetrics: {
        revenue: rangeRevenue,
        subtotal: rangeSubtotal,
        tips: rangeTips,
        tax: rangeTax,
        discounts: rangeDiscounts,
        expenses: rangeExpenses,
        netProfit: rangeRevenue - rangeExpenses,
        invoiceCount: rangePaid.length,
        avgTransactionValue,
        newCustomers: rangeCustomers.length,
      },
      dailyRevenue,
      busiestHours,
      paymentMethods,
      staffPerformance,
      allServices: allServicesData,
      serviceCategories,
      allProducts: allProductsData,
      expenseByCategory,
      thisMonthExpenses,
      appointmentStats,
      orderStats,
    });
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}
