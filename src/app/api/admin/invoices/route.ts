import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
            customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
            server: { select: { id: true, firstName: true, lastName: true } },
            items: {
              select: {
                id: true,
                unitPrice: true,
                quantity: true,
                service: { select: { name: true } },
              },
            },
            products: {
              select: {
                id: true,
                unitPrice: true,
                quantity: true,
                product: { select: { name: true } },
              },
            },
          },
        },
        payment: true,
      },
    });
    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}
