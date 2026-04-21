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

  return <ExpensesClient />;
}
