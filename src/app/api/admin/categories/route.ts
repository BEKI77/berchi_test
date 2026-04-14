import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { serviceCategories, productCategories } from "@/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "service" or "product"

  try {
    if (type === "product") {
      const categories = await db.select().from(productCategories).orderBy(asc(productCategories.name));
      return NextResponse.json(categories);
    }
    // default: service categories
    const categories = await db.select().from(serviceCategories).orderBy(asc(serviceCategories.name));
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description, type } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
    }

    if (type === "product") {
      const [cat] = await db.insert(productCategories).values({ name, description: description || null }).returning();
      return NextResponse.json(cat);
    }

    const [cat] = await db.insert(serviceCategories).values({ name, description: description || null }).returning();
    return NextResponse.json(cat);
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
