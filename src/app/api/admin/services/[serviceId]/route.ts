import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services, serviceConsumables } from "@/db/schema";
import { toSantim } from "@/lib/money";

export async function PATCH(req: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { serviceId } = await params;

  try {
    const body = await req.json();
    const { 
      name, description, categoryId, basePrice, durationMinutes, isActive,
      consumables // Array of { productId, portionsRequired }
    } = body;

    const result = await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description || null;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (basePrice !== undefined) updateData.basePrice = toSantim(basePrice);
      if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
      if (isActive !== undefined) updateData.isActive = isActive;

      if (Object.keys(updateData).length > 0) {
        await tx.update(services).set(updateData).where(eq(services.id, serviceId));
      }

      if (consumables !== undefined) {
        // Simple approach: delete all and re-insert
        await tx.delete(serviceConsumables).where(eq(serviceConsumables.serviceId, serviceId));
        if (consumables.length > 0) {
          await tx.insert(serviceConsumables).values(
            consumables.map((c: any) => ({
              serviceId,
              productId: c.productId,
              portionsRequired: c.portionsRequired,
            }))
          );
        }
      }

      return await tx.query.services.findFirst({
        where: eq(services.id, serviceId),
        with: { category: true, consumables: { with: { product: true } } },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}
