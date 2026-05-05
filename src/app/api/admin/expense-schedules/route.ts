import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { expenseSchedules } from "@/db/schema";
import type { NewExpenseSchedule } from "@/db/schema/types";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await hasPermission(session.user.id, "expenses.view");
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await db.query.expenseSchedules.findMany({
      orderBy: [desc(expenseSchedules.createdAt)],
      with: {
        createdBy: { columns: { firstName: true, lastName: true } },
        payeeStaff: { columns: { firstName: true, lastName: true } },
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch expense schedules:", error);
    return NextResponse.json({ error: "Failed to fetch expense schedules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canCreate = await hasPermission(session.user.id, "expenses.create");
  if (!canCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
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
    } = body;

    if (!name || !category || !amount || !frequency || !startDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Calculate next due date based on frequency
    let nextDueDate = new Date(startDate);
    if (frequency === "MONTHLY" && dayOfMonth) {
      nextDueDate.setDate(dayOfMonth);
    } else if (frequency === "WEEKLY" && dayOfWeek !== undefined) {
      const dayDiff = (dayOfWeek - nextDueDate.getDay() + 7) % 7;
      nextDueDate.setDate(nextDueDate.getDate() + dayDiff);
    }

    const newSchedule: NewExpenseSchedule = {
      name,
      description: description || null,
      category,
      amount: String(amount),
      frequency,
      interval: interval || 1,
      dayOfMonth: dayOfMonth || null,
      dayOfWeek: dayOfWeek || null,
      startDate: new Date(startDate).toISOString().split("T")[0],
      endDate: endDate ? new Date(endDate).toISOString().split("T")[0] : null,
      nextDueDate: nextDueDate.toISOString().split("T")[0],
      payeeStaffId: payeeStaffId || null,
      payeeName: payeeName || null,
      autoPost: autoPost || false,
      createdBy: session.user.id,
    };

    const [schedule] = await db.insert(expenseSchedules).values(newSchedule).returning();

    const fullSchedule = await db.query.expenseSchedules.findFirst({
      where: eq(expenseSchedules.id, schedule.id),
      with: {
        createdBy: { columns: { firstName: true, lastName: true } },
        payeeStaff: { columns: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(fullSchedule);
  } catch (error) {
    console.error("Failed to create expense schedule:", error);
    return NextResponse.json({ error: "Failed to create expense schedule" }, { status: 500 });
  }
}
