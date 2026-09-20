import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { invoices } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await hasPermission(session.user.id, "billing.view");
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await db.query.invoices.findMany({
      orderBy: [desc(invoices.createdAt)],
      with: {
        order: {
          columns: { orderNumber: true, walkInName: true },
          with: {
            customer: { columns: { id: true, firstName: true, lastName: true, phone: true } },
            server: { columns: { id: true, firstName: true, lastName: true } },
            items: {
              columns: { id: true, unitPrice: true, quantity: true },
              with: { service: { columns: { name: true } } },
            },
            products: {
              columns: { id: true, unitPrice: true, quantity: true },
              with: { product: { columns: { name: true } } },
            },
          },
        },
        payment: true,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}
