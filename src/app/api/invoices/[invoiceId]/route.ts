import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { invoiceId } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        order: {
          select: {
            orderNumber: true,
            startedAt: true,
            customer: { select: { firstName: true, lastName: true, phone: true } },
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
        },
        payment: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 });
  }
}
