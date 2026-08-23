import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { toBasisPoints } from "@/lib/money";

export async function PATCH(req: Request, { params }: { params: Promise<{ staffId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { staffId } = await params;

  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, role, commissionRate, isActive, password } = body;

    const updateData: Record<string, unknown> = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;
    if (role !== undefined) updateData.role = role;
    if (commissionRate !== undefined) updateData.commissionRate = toBasisPoints(commissionRate);
    if (isActive !== undefined) updateData.isActive = isActive;

    if (password) {
      const bcrypt = await import("bcryptjs");
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const [updated] = await db
      .update(staff)
      .set(updateData)
      .where(eq(staff.id, staffId))
      .returning({
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        commissionRate: staff.commissionRate,
        isActive: staff.isActive,
      });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update staff:", error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}
