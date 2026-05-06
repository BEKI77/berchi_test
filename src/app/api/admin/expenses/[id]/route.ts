import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { expenses } from "@/db/schema";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canUpdate = await hasPermission(session.user.id, "expenses.update");
  if (!canUpdate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, date, amount, receiptUrl } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (date !== undefined) updateData.date = new Date(date).toISOString().split("T")[0];
    if (amount !== undefined) updateData.amount = String(amount);
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;

    const [expense] = await db
      .update(expenses)
      .set(updateData)
      .where(eq(expenses.id, id))
      .returning();

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const fullExpense = await db.query.expenses.findFirst({
      where: eq(expenses.id, id),
      with: {
        staff: { columns: { firstName: true, lastName: true } },
        schedule: true,
        payeeStaff: { columns: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(fullExpense);
  } catch (error) {
    console.error("Failed to update expense:", error);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canDelete = await hasPermission(session.user.id, "expenses.delete");
  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const expense = await db.query.expenses.findFirst({
      where: eq(expenses.id, id),
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await db.delete(expenses).where(eq(expenses.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
