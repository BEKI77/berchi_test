import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { expenseSchedules } from "@/db/schema";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await hasPermission(session.user.id, "expenses.schedule.manage");
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      description,
      category,
      amount,
      frequency,
      interval,
      dayOfMonth,
      dayOfWeek,
      startDate,
      endDate,
      payeeStaffId,
      payeeName,
      autoPost,
      isActive,
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = String(amount);
    if (frequency !== undefined) updateData.frequency = frequency;
    if (interval !== undefined) updateData.interval = interval;
    if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
    if (startDate !== undefined) updateData.startDate = new Date(startDate).toISOString().split("T")[0];
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate).toISOString().split("T")[0] : null;
    if (payeeStaffId !== undefined) updateData.payeeStaffId = payeeStaffId;
    if (payeeName !== undefined) updateData.payeeName = payeeName;
    if (autoPost !== undefined) updateData.autoPost = autoPost;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [schedule] = await db
      .update(expenseSchedules)
      .set(updateData)
      .where(eq(expenseSchedules.id, id))
      .returning();

    if (!schedule) {
      return NextResponse.json({ error: "Expense schedule not found" }, { status: 404 });
    }

    const fullSchedule = await db.query.expenseSchedules.findFirst({
      where: eq(expenseSchedules.id, id),
      with: {
        createdBy: { columns: { firstName: true, lastName: true } },
        payeeStaff: { columns: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(fullSchedule);
  } catch (error) {
    console.error("Failed to update expense schedule:", error);
    return NextResponse.json({ error: "Failed to update expense schedule" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await hasPermission(session.user.id, "expenses.schedule.manage");
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Hard delete the schedule
    const deletedSchedule = await db
      .delete(expenseSchedules)
      .where(eq(expenseSchedules.id, id))
      .returning();

    if (deletedSchedule.length === 0) {
      return NextResponse.json({ error: "Expense schedule not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expense schedule:", error);
    return NextResponse.json({ error: "Failed to delete expense schedule" }, { status: 500 });
  }
}
