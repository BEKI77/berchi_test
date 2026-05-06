import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte  } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { expenseSchedules } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canViewExpenses = await hasPermission(session.user.id, "expenses.view");
  if (!canViewExpenses) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get active expense schedules that have due dates
    const schedules = await db.query.expenseSchedules.findMany({
      where: and(
        eq(expenseSchedules.isActive, true),
        gte(expenseSchedules.nextDueDate, today),
        lte(expenseSchedules.nextDueDate, sql`(${today}::date + interval '30 days')`)
      ),
      with: {
        createdBy: {
          columns: { firstName: true, lastName: true }
        },
        payeeStaff: {
          columns: { firstName: true, lastName: true }
        }
      },
      orderBy: [expenseSchedules.nextDueDate]
    });

    // Generate upcoming expense items from schedules
    const upcomingExpenses = schedules.map(schedule => ({
      id: `schedule-${schedule.id}`, // Use a prefix to distinguish from actual expenses
      description: schedule.description || schedule.name,
      category: schedule.category,
      amount: schedule.amount,
      date: schedule.nextDueDate,
      status: "DUE",
      type: "RECURRING",
      scheduleId: schedule.id,
      schedule: {
        id: schedule.id,
        name: schedule.name,
        frequency: schedule.frequency,
        interval: schedule.interval
      },
      payeeStaffId: schedule.payeeStaffId,
      payeeName: schedule.payeeName,
      staff: schedule.createdBy,
      isGenerated: true // Flag to indicate this is generated from schedule
    }));

    return NextResponse.json(upcomingExpenses);
  } catch (error) {
    console.error("Failed to fetch upcoming expenses:", error);
    return NextResponse.json({ error: "Failed to fetch upcoming expenses" }, { status: 500 });
  }
}
