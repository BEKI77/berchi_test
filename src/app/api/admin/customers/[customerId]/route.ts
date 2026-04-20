import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, desc, not, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customers, serviceOrders, appointments, invoices } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { customerId } = await params;

    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get SYSTEM_BLOCK customer IDs to exclude
    const systemBlockCustomers = await db.select({ id: customers.id })
      .from(customers)
      .where(eq(customers.lastName, "SYSTEM_BLOCK"));
    
    const systemBlockCustomerIds = systemBlockCustomers.map(c => c.id);

    const [orders, appts, allInvoices] = await Promise.all([
      db.query.serviceOrders.findMany({
        where: eq(serviceOrders.customerId, customerId),
        orderBy: [desc(serviceOrders.startedAt)],
        limit: 30,
        columns: { id: true, orderNumber: true, status: true, startedAt: true, completedAt: true },
        with: {
          server: { columns: { firstName: true, lastName: true } },
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
      db.query.appointments.findMany({
        where: systemBlockCustomerIds.length > 0 ? 
          not(inArray(appointments.customerId, systemBlockCustomerIds)) : undefined,
        orderBy: [desc(appointments.startTime)],
        limit: 20,
        columns: { id: true, startTime: true, status: true },
        with: {
          staff: { columns: { firstName: true, lastName: true } },
          service: { columns: { name: true } },
        },
      }),
      db.query.invoices.findMany({
        orderBy: [desc(invoices.createdAt)],
        columns: { id: true, invoiceNumber: true, totalAmount: true, tipAmount: true, status: true, createdAt: true },
        with: {
          order: { columns: { customerId: true } },
          payment: { columns: { method: true } },
        },
      }),
    ]);

    // Filter invoices by customerId (Drizzle doesn't support nested where on relations easily)
    const customerInvoices = allInvoices
      .filter((i) => i.order?.customerId === customerId)
      .slice(0, 20)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ order, ...rest }) => rest);

    const totalSpent = allInvoices
      .filter((i) => i.order?.customerId === customerId && i.status === "PAID")
      .reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalVisits = orders.length;
    const totalTips = allInvoices
      .filter((i) => i.order?.customerId === customerId)
      .reduce((s, i) => s + Number(i.tipAmount), 0);

    // Favorite services
    const serviceMap: Record<string, number> = {};
    orders.forEach((o) =>
      o.items.forEach((i) => {
        serviceMap[i.service.name] = (serviceMap[i.service.name] || 0) + i.quantity;
      })
    );
    const favoriteServices = Object.entries(serviceMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      customer,
      stats: { totalSpent, totalVisits, totalTips },
      favoriteServices,
      recentOrders: orders,
      recentAppointments: appts,
      recentInvoices: customerInvoices,
    });
  } catch (error) {
    console.error("Failed to fetch customer detail:", error);
    return NextResponse.json({ error: "Failed to fetch customer detail" }, { status: 500 });
  }
}
