import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { products, productUsageLogs, stockMovements } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Calculate average portions used per client per product
    const yieldStats = await db
      .select({
        productId: productUsageLogs.productId,
        productName: products.name,
        totalPortionsUsed: sql<number>`sum(${productUsageLogs.portionsUsed})`,
        totalClientsServed: sql<number>`count(distinct ${productUsageLogs.orderId})`,
        avgPortionsPerClient: sql<number>`avg(${productUsageLogs.portionsUsed})`,
        portionsPerUnit: products.portionsPerUnit,
      })
      .from(productUsageLogs)
      .leftJoin(products, eq(productUsageLogs.productId, products.id))
      .groupBy(productUsageLogs.productId, products.name, products.portionsPerUnit);

    const reports = yieldStats.map(stat => {
      const portionsPerUnit = stat.portionsPerUnit || 1;
      const clientsPerUnit = portionsPerUnit / (stat.avgPortionsPerClient || 1);
      
      return {
        ...stat,
        clientsPerUnit: Number(clientsPerUnit.toFixed(1)),
        yieldEfficiency: 100, // Placeholder for future AI comparison against "Expected"
      };
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error("Failed to generate yield report:", error);
    return NextResponse.json({ error: "Failed to generate yield report" }, { status: 500 });
  }
}
