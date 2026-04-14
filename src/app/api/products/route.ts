import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { and, eq, gt, asc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.query.products.findMany({
    where: and(eq(products.isActive, true), gt(products.quantityOnHand, 0)),
    with: { category: { columns: { id: true, name: true } } },
    orderBy: [asc(products.name)],
  });

  result.sort((a, b) => {
    const catCmp = (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
    return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
  });

  return NextResponse.json(result);
}
