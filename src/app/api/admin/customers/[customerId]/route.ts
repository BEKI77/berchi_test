import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const [orders, appointments, invoices] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: { customerId },
        orderBy: { startedAt: "desc" },
        take: 30,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          startedAt: true,
          completedAt: true,
          server: { select: { firstName: true, lastName: true } },
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
      prisma.appointment.findMany({
        where: { customerId },
        orderBy: { startTime: "desc" },
        take: 20,
        select: {
          id: true,
          startTime: true,
          status: true,
          staff: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { order: { customerId } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          tipAmount: true,
          status: true,
          createdAt: true,
          payment: { select: { method: true } },
        },
      }),
    ]);

    const totalSpent = invoices
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalVisits = orders.length;
    const totalTips = invoices.reduce((s, i) => s + Number(i.tipAmount), 0);

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
      recentAppointments: appointments,
      recentInvoices: invoices,
    });
  } catch (error) {
    console.error("Failed to fetch customer detail:", error);
    return NextResponse.json({ error: "Failed to fetch customer detail" }, { status: 500 });
  }
}
