import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { TransactionsClient } from "./transactions-client";

export default async function CashierTransactionsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewTransactions = await hasPermission(session.user.id, "billing.view");
  if (!canViewTransactions) {
    redirect("/");
  }

  return <TransactionsClient />;
}
