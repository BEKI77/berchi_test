import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, sql, avg, count } from "drizzle-orm";
import { db } from "@/db";
import { 
  serviceOrderItems, 
  orderItemConsumables, 
  services, 
  products,
  serviceOrders
} from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Join services -> orderItems -> consumables -> products
    // We only want data from completed/checked out orders for finality
    const usageData = await db
      .select({
        serviceId: services.id,
        serviceName: services.name,
        productId: products.id,
        productName: products.name,
        avgUsage: sql<number>`avg(${orderItemConsumables.portionsUsed})`,
        minUsage: sql<number>`min(${orderItemConsumables.portionsUsed})`,
        maxUsage: sql<number>`max(${orderItemConsumables.portionsUsed})`,
        totalSessions: sql<number>`count(${orderItemConsumables.id})`,
      })
      .from(orderItemConsumables)
      .innerJoin(serviceOrderItems, eq(orderItemConsumables.orderItemId, serviceOrderItems.id))
      .innerJoin(services, eq(serviceOrderItems.serviceId, services.id))
      .innerJoin(products, eq(orderItemConsumables.productId, products.id))
      .innerJoin(serviceOrders, eq(serviceOrderItems.orderId, serviceOrders.id))
      .where(eq(serviceOrders.status, "CHECKED_OUT"))
      .groupBy(services.id, services.name, products.id, products.name);

    return NextResponse.json(usageData);
  } catch (error) {
    console.error("Failed to generate service usage report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
