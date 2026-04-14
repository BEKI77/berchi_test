import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await db.query.expenses.findMany({
      orderBy: [desc(expenses.date)],
      with: { staff: { columns: { firstName: true, lastName: true } } },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { description, category, amount, date } = body;

    if (!description || !category || !amount || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [expense] = await db
      .insert(expenses)
      .values({
        description,
        category,
        amount,
        date: new Date(date).toISOString().split("T")[0],
        loggedBy: session.user.id,
      })
      .returning();

    const fullExpense = await db.query.expenses.findFirst({
      where: eq(expenses.id, expense.id),
      with: { staff: { columns: { firstName: true, lastName: true } } },
    });

    return NextResponse.json(fullExpense);
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
