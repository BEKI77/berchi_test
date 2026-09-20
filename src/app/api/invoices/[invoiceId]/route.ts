import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { invoices } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await hasPermission(session.user.id, "billing.view");
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { invoiceId } = await params;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: {
        order: {
          columns: { orderNumber: true, startedAt: true, walkInName: true },
          with: {
            customer: { columns: { firstName: true, lastName: true, phone: true } },
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
