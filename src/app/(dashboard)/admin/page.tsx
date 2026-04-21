import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { AdminDashboardClient } from "./dashboard-client";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewDashboard = await hasPermission(session.user.id, "dashboard.view");
  if (!canViewDashboard) {
    redirect("/");
  }

  return <AdminDashboardClient firstName={session.user.firstName} />;
}
