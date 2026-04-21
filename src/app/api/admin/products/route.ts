import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { products } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const canView = await hasPermission(session.user.id, "inventory.view");
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await db.query.products.findMany({
      with: { category: true },
      orderBy: [asc(products.name)],
    });
    result.sort((a, b) => {
      const catCmp = (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
      return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canCreate = await hasPermission(session.user.id, "inventory.create");
  if (!canCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { 
      name, sku, categoryId, costPrice, sellPrice, 
      usagePrice, quantityOnHand, reorderLevel,
      isConsumable, portionsPerUnit, remainingPortions 
    } = body;

    if (!name || !categoryId || costPrice === undefined || sellPrice === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [product] = await db
      .insert(products)
      .values({
        name,
        sku: sku || null,
        categoryId,
        costPrice,
        sellPrice,
        usagePrice: usagePrice || 0,
        quantityOnHand: quantityOnHand || 0,
        reorderLevel: reorderLevel || 5,
        isConsumable: isConsumable || false,
        portionsPerUnit: portionsPerUnit || 1,
        remainingPortions: remainingPortions || 0,
      })
      .returning();

    const fullProduct = await db.query.products.findFirst({
      where: eq(products.id, product.id),
      with: { category: true },
    });

    return NextResponse.json(fullProduct);
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
