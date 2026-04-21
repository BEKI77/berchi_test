import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ServerHistoryClient } from "./history-client";

export default async function ServerHistoryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewHistory = await hasPermission(session.user.id, "orders.view");
  if (!canViewHistory) {
    redirect("/");
  }

  return <ServerHistoryClient userId={session.user.id} />;
}
