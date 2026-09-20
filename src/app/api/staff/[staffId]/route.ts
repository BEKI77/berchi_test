import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { toBasisPoints } from "@/lib/money";
import { pinProblem } from "@/lib/pin-config";
import { clearStaffPin, setStaffPin } from "@/lib/pin";

// What a staff request may see. Never a hash: hasPin only says whether one is set.
const staffColumns = {
  id: staff.id,
  firstName: staff.firstName,
  lastName: staff.lastName,
  email: staff.email,
  phone: staff.phone,
  role: staff.role,
  commissionRate: staff.commissionRate,
  isActive: staff.isActive,
  hasPin: sql<boolean>`${staff.pinHash} is not null`,
};

export async function PATCH(req: Request, { params }: { params: Promise<{ staffId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { staffId } = await params;

  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, role, commissionRate, isActive, password, pin, clearPin } = body;

    // Check the PIN before changing anything, so a refused PIN cannot leave the
    // rest of the edit half-applied.
    const settingPin = typeof pin === "string" && pin !== "";
    if (settingPin || clearPin) {
      const [current] = await db.select({ role: staff.role }).from(staff).where(eq(staff.id, staffId)).limit(1);
      if (!current) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
      }
      if (settingPin) {
        if ((role ?? current.role) !== "SERVER") {
          return NextResponse.json({ error: "PINs are for stylists only" }, { status: 400 });
        }
        const problem = pinProblem(pin);
        if (problem) {
          return NextResponse.json({ error: problem }, { status: 400 });
        }
      }
    }

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

    // A request that only sets a PIN has nothing for this UPDATE to change.
    if (Object.keys(updateData).length > 0) {
      await db.update(staff).set(updateData).where(eq(staff.id, staffId));
    }
    if (settingPin) await setStaffPin(staffId, pin);
    else if (clearPin) await clearStaffPin(staffId);

    const [updated] = await db.select(staffColumns).from(staff).where(eq(staff.id, staffId)).limit(1);
    if (!updated) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update staff:", error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}
