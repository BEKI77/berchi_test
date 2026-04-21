import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { CashierPendingClient } from "./pending-client";

export default async function CashierPendingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canAccess = await hasPermission(session.user.id, "orders.checkout");
  if (!canAccess) {
    redirect("/");
  }

  return <CashierPendingClient />;
}
