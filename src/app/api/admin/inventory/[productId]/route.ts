import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { products, stockMovements, serviceOrderProducts } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { productId } = await params;

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      with: { category: { columns: { id: true, name: true } } },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const [movements, orderProducts] = await Promise.all([
      db.query.stockMovements.findMany({
        where: eq(stockMovements.productId, productId),
        orderBy: [desc(stockMovements.createdAt)],
        limit: 50,
        with: { staff: { columns: { firstName: true, lastName: true } } },
      }),
      db.query.serviceOrderProducts.findMany({
        where: eq(serviceOrderProducts.productId, productId),
        limit: 30,
        columns: { id: true, quantity: true, unitPrice: true },
        with: {
          order: {
            columns: { orderNumber: true, startedAt: true },
            with: {
              customer: { columns: { firstName: true, lastName: true } },
              server: { columns: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    // Sort orderProducts by order.startedAt desc in JS
    orderProducts.sort((a, b) =>
      new Date(b.order.startedAt).getTime() - new Date(a.order.startedAt).getTime()
    );

    const totalUsed = orderProducts.reduce((s, p) => s + p.quantity, 0);
    const totalRevenue = orderProducts.reduce(
      (s, p) => s + Number(p.unitPrice) * p.quantity, 0
    );

    return NextResponse.json({
      product,
      stockMovements: movements,
      usageHistory: orderProducts,
      stats: {
        totalUsed,
        totalRevenue,
        movementCount: movements.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch product detail:", error);
    return NextResponse.json({ error: "Failed to fetch product detail" }, { status: 500 });
  }
}
