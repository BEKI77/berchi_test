import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ExpensesClient } from "./expenses-client";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewExpenses = await hasPermission(session.user.id, "expenses.view");
  if (!canViewExpenses) {
    redirect("/");
  }

  const canDeleteExpenses = await hasPermission(session.user.id, "expenses.delete");
  const canUpdateExpenses = await hasPermission(session.user.id, "expenses.update");
  const canManageSchedules = await hasPermission(session.user.id, "expenses.schedule.manage");

  console.log("Permission checks for user", session.user.id, {
    canDeleteExpenses,
    canUpdateExpenses,
    canManageSchedules,
  });

  return (
    <ExpensesClient
      canDeleteExpenses={canDeleteExpenses}
      canUpdateExpenses={canUpdateExpenses}
      canManageSchedules={canManageSchedules}
    />
  );
}
