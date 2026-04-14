import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TransactionsClient } from "./transactions-client";

export default async function CashierTransactionsPage() {
  const session = await auth();
  if (session?.user?.role !== "CASHIER" && session?.user?.role !== "OWNER") {
    redirect("/");
  }

  return <TransactionsClient />;
}
