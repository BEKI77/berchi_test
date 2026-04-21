import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceCategories, productCategories } from "@/db/schema";

export async function PATCH(
  req: Request, 
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { categoryId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "service" or "product"

  try {
    const body = await req.json();
    const { name, description, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    let result;
    if (type === "product") {
      [result] = await db
        .update(productCategories)
        .set(updateData)
        .where(eq(productCategories.id, categoryId))
        .returning();
    } else {
      [result] = await db
        .update(serviceCategories)
        .set(updateData)
        .where(eq(serviceCategories.id, categoryId))
        .returning();
    }

    if (!result) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update category:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { categoryId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "service" or "product"

  try {
    let result;
    if (type === "product") {
      [result] = await db
        .delete(productCategories)
        .where(eq(productCategories.id, categoryId))
        .returning();
    } else {
      [result] = await db
        .delete(serviceCategories)
        .where(eq(serviceCategories.id, categoryId))
        .returning();
    }

    if (!result) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Failed to delete category:", error);
    
    // Check if it's a foreign key constraint error
    if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
      return NextResponse.json({ 
        error: "Cannot delete category that is being used by services or products" 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
