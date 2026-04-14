import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CashierPendingClient } from "./pending-client";

export default async function CashierPendingPage() {
  const session = await auth();
  if (session?.user?.role !== "CASHIER" && session?.user?.role !== "OWNER") {
    redirect("/");
  }

  return <CashierPendingClient />;
}
