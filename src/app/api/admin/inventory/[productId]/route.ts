import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const [stockMovements, orderProducts] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          staff: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.serviceOrderProduct.findMany({
        where: { productId },
        orderBy: { order: { startedAt: "desc" } },
        take: 30,
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          order: {
            select: {
              orderNumber: true,
              startedAt: true,
              customer: { select: { firstName: true, lastName: true } },
              server: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    const totalUsed = orderProducts.reduce((s, p) => s + p.quantity, 0);
    const totalRevenue = orderProducts.reduce(
      (s, p) => s + Number(p.unitPrice) * p.quantity, 0
    );

    return NextResponse.json({
      product,
      stockMovements,
      usageHistory: orderProducts,
      stats: {
        totalUsed,
        totalRevenue,
        movementCount: stockMovements.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch product detail:", error);
    return NextResponse.json({ error: "Failed to fetch product detail" }, { status: 500 });
  }
}
