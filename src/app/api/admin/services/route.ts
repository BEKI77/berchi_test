import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services, serviceConsumables } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.query.services.findMany({
      with: { category: true, consumables: { with: { product: true } } },
      orderBy: [asc(services.name)],
    });
    result.sort((a, b) => {
      const catCmp = (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
      return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { 
      name, description, categoryId, basePrice, durationMinutes, 
      consumables = [] // Array of { productId, portionsRequired }
    } = body;

    if (!name || !categoryId || basePrice === undefined || !durationMinutes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [service] = await tx
        .insert(services)
        .values({
          name,
          description: description || null,
          categoryId,
          basePrice,
          durationMinutes,
        })
        .returning();

      if (consumables.length > 0) {
        await tx.insert(serviceConsumables).values(
          consumables.map((c: any) => ({
            serviceId: service.id,
            productId: c.productId,
            portionsRequired: c.portionsRequired,
          }))
        );
      }

      return await tx.query.services.findFirst({
        where: eq(services.id, service.id),
        with: { category: true, consumables: { with: { product: true } } },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to create service:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
