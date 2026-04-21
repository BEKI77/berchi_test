import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewReports = await hasPermission(session.user.id, "reports.view");
  if (!canViewReports) {
    redirect("/");
  }

  return <ReportsClient />;
}
