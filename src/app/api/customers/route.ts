import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
      email: customers.email,
      notes: customers.notes,
    })
    .from(customers)
    .orderBy(asc(customers.firstName));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { firstName, lastName, phone, email, notes } = body;

  if (!firstName) {
    return NextResponse.json(
      { error: "First name is required" },
      { status: 400 }
    );
  }

  const [customer] = await db
    .insert(customers)
    .values({ firstName, lastName: lastName || "", phone, email, notes })
    .returning();

  return NextResponse.json(customer, { status: 201 });
}
