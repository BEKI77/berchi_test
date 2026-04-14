import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

export async function PATCH(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productId } = await params;

  try {
    const body = await req.json();
    const { name, sku, categoryId, costPrice, sellPrice, usagePrice, quantityOnHand, reorderLevel, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (sku !== undefined) updateData.sku = sku || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (costPrice !== undefined) updateData.costPrice = costPrice;
    if (sellPrice !== undefined) updateData.sellPrice = sellPrice;
    if (usagePrice !== undefined) updateData.usagePrice = usagePrice;
    if (quantityOnHand !== undefined) updateData.quantityOnHand = quantityOnHand;
    if (reorderLevel !== undefined) updateData.reorderLevel = reorderLevel;
    if (isActive !== undefined) updateData.isActive = isActive;

    await db.update(products).set(updateData).where(eq(products.id, productId));

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      with: { category: true },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
