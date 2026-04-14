import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db
      .select({
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        commissionRate: staff.commissionRate,
        isActive: staff.isActive,
        createdAt: staff.createdAt,
      })
      .from(staff)
      .orderBy(desc(staff.createdAt));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch staff:", error);
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, role, commissionRate, password } = body;

    if (!firstName || !lastName || !email || !role || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [existing] = await db.select().from(staff).where(eq(staff.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    const [newStaff] = await db
      .insert(staff)
      .values({
        firstName,
        lastName,
        email,
        phone: phone || null,
        role,
        commissionRate: commissionRate || 0,
        passwordHash,
      })
      .returning();

    return NextResponse.json({ id: newStaff.id, firstName: newStaff.firstName, lastName: newStaff.lastName });
  } catch (error) {
    console.error("Failed to create staff:", error);
    return NextResponse.json({ error: "Failed to create staff" }, { status: 500 });
  }
}
