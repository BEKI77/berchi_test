import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";

export async function PATCH(req: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { serviceId } = await params;

  try {
    const body = await req.json();
    const { name, description, categoryId, basePrice, durationMinutes, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (basePrice !== undefined) updateData.basePrice = basePrice;
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (isActive !== undefined) updateData.isActive = isActive;

    await db.update(services).set(updateData).where(eq(services.id, serviceId));

    const service = await db.query.services.findFirst({
      where: eq(services.id, serviceId),
      with: { category: true },
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error("Failed to update service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}
