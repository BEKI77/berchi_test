import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { expenses, expenseSchedules } from "@/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await hasPermission(session.user.id, "expenses.view");
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const scheduleId = searchParams.get("scheduleId");

    let whereClause;
    const conditions = [];

    if (status) {
      conditions.push(sql`${expenses.status} = ${status}`);
    }
    if (type) {
      conditions.push(sql`${expenses.type} = ${type}`);
    }
    if (scheduleId) {
      conditions.push(eq(expenses.scheduleId, scheduleId));
    }

    if (conditions.length > 0) {
      whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    }

    const result = await db.query.expenses.findMany({
      where: whereClause,
      orderBy: [desc(expenses.date)],
      with: {
        staff: { columns: { firstName: true, lastName: true } },
        schedule: true,
        payeeStaff: { columns: { firstName: true, lastName: true } },
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
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
    const { description, category, amount, date, scheduleId, status } = body;

    // Handle creating expense from schedule
    if (scheduleId) {
      const schedule = await db.query.expenseSchedules.findFirst({
        where: eq(expenseSchedules.id, scheduleId)
      });

      if (!schedule) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
      }

      const [expense] = await db
        .insert(expenses)
        .values({
          description: schedule.description || schedule.name,
          category: schedule.category,
          amount: schedule.amount,
          date: date || new Date().toISOString().split("T")[0],
          loggedBy: session.user.id,
          type: "RECURRING",
          status: status || "DUE",
          scheduleId: schedule.id,
          payeeStaffId: schedule.payeeStaffId,
          payeeName: schedule.payeeName,
      })
      .returning();

    // Update schedule's next due date
    let nextDueDate = new Date(schedule.nextDueDate);
    
    // Calculate next due date based on frequency
    switch (schedule.frequency) {
      case "DAILY":
        nextDueDate.setDate(nextDueDate.getDate() + schedule.interval);
        break;
      case "WEEKLY":
        nextDueDate.setDate(nextDueDate.getDate() + (schedule.interval * 7));
        break;
      case "MONTHLY":
        nextDueDate.setMonth(nextDueDate.getMonth() + schedule.interval);
        break;
      case "YEARLY":
        nextDueDate.setFullYear(nextDueDate.getFullYear() + schedule.interval);
        break;
    }
    
    const newNextDueDate = nextDueDate.toISOString().split('T')[0];
    console.log("New nextDueDate:", newNextDueDate);
    
    await db
      .update(expenseSchedules)
      .set({ 
        nextDueDate: newNextDueDate,
        updatedAt: new Date()
      })
      .where(eq(expenseSchedules.id, schedule.id));

    const fullExpense = await db.query.expenses.findFirst({
      where: eq(expenses.id, expense.id),
      with: { staff: { columns: { firstName: true, lastName: true } } },
    });

    return NextResponse.json(fullExpense);
    }

    // Regular expense creation
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
        type: "SPONTANEOUS",
        status: status || "DUE",
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
