import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { customers } from "@/db/schema";

export async function PATCH(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canUpdate = await hasPermission(session.user.id, "customers.update");
  if (!canUpdate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await params;

  try {
    const body = await req.json();
    const { firstName, lastName, phone, email, notes, birthday } = body;

    const updateData: Record<string, unknown> = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (notes !== undefined) updateData.notes = notes;
    if (birthday !== undefined) updateData.birthday = birthday ? new Date(birthday).toISOString().split("T")[0] : null;

    const [customer] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, customerId))
      .returning();

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to update customer:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}
