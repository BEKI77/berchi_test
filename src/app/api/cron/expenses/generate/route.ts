import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenseSchedules, expenses } from "@/db/schema";

function calculateNextDueDate(
  frequency: string,
  interval: number,
  currentDueDate: Date,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): Date {
  const nextDate = new Date(currentDueDate);

  switch (frequency) {
    case "DAILY":
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case "WEEKLY":
      nextDate.setDate(nextDate.getDate() + (interval * 7));
      if (dayOfWeek !== undefined && dayOfWeek !== null) {
        const dayDiff = (dayOfWeek - nextDate.getDay() + 7) % 7;
        nextDate.setDate(nextDate.getDate() + dayDiff);
      }
      break;
    case "MONTHLY":
      nextDate.setMonth(nextDate.getMonth() + interval);
      if (dayOfMonth) {
        nextDate.setDate(dayOfMonth);
      }
      break;
    case "YEARLY":
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
    case "CUSTOM":
      // For custom, just add interval days as a default
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    default:
      nextDate.setDate(nextDate.getDate() + interval);
  }

  return nextDate;
}

async function generateDueExpenses(now: Date = new Date()) {
  const todayStr = now.toISOString().split("T")[0];

  // Get all active schedules where nextDueDate <= today
  const schedules = await db.query.expenseSchedules.findMany({
    where: and(
      eq(expenseSchedules.isActive, true),
      sql`${expenseSchedules.nextDueDate} <= ${todayStr}`,
    ),
  });

  const generatedExpenses = [];

  for (const schedule of schedules) {
    const nextDueDate = new Date(schedule.nextDueDate);

    // Check if endDate is reached
    if (schedule.endDate && nextDueDate > new Date(schedule.endDate)) {
      // Deactivate schedule if end date passed
      await db
        .update(expenseSchedules)
        .set({ isActive: false })
        .where(eq(expenseSchedules.id, schedule.id));
      continue;
    }

    // Check if expense already exists for this schedule and due date
    const existingExpense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.scheduleId, schedule.id),
        eq(expenses.dueDate, schedule.nextDueDate),
      ),
    });

    if (existingExpense) {
      // Expense already generated, skip but advance nextDueDate
      const nextDate = calculateNextDueDate(
        schedule.frequency,
        schedule.interval,
        nextDueDate,
        schedule.dayOfMonth,
        schedule.dayOfWeek,
      );

      await db
        .update(expenseSchedules)
        .set({ nextDueDate: nextDate.toISOString().split("T")[0] })
        .where(eq(expenseSchedules.id, schedule.id));
      continue;
    }

    // Create the expense occurrence
    const status = schedule.autoPost ? "PAID" : "DUE";
    const [expense] = await db
      .insert(expenses)
      .values({
        description: `${schedule.name} - ${new Date(schedule.nextDueDate).toLocaleDateString()}`,
        category: schedule.category,
        amount: schedule.amount,
        date: new Date(schedule.nextDueDate).toISOString().split("T")[0],
        dueDate: schedule.nextDueDate,
        type: "RECURRING",
        status: status,
        scheduleId: schedule.id,
        payeeStaffId: schedule.payeeStaffId,
        payeeName: schedule.payeeName,
        loggedBy: schedule.createdBy,
      })
      .returning();

    generatedExpenses.push(expense);

    // Calculate and update next due date
    const nextDate = calculateNextDueDate(
      schedule.frequency,
      schedule.interval,
      nextDueDate,
      schedule.dayOfMonth,
      schedule.dayOfWeek,
    );

    await db
      .update(expenseSchedules)
      .set({ nextDueDate: nextDate.toISOString().split("T")[0] })
      .where(eq(expenseSchedules.id, schedule.id));
  }

  return generatedExpenses;
}

export async function POST(req: Request) {
  // In production, this should be protected with a cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { now } = body;
    const targetDate = now ? new Date(now) : new Date();

    const generatedExpenses = await generateDueExpenses(targetDate);

    return NextResponse.json({
      success: true,
      generated: generatedExpenses.length,
      expenses: generatedExpenses,
    });
  } catch (error) {
    console.error("Failed to generate due expenses:", error);
    return NextResponse.json({ error: "Failed to generate due expenses" }, { status: 500 });
  }
}
