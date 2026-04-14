import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExpensesClient } from "./expenses-client";

export default async function ExpensesPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/");

  return <ExpensesClient />;
}
