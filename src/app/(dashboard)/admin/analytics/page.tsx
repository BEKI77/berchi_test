import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ServiceUsageClient } from "./usage-client";

export default async function ServiceUsagePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewUsage = await hasPermission(session.user.id, "reports.view");
  if (!canViewUsage) {
    redirect("/");
  }

  return <ServiceUsageClient />;
}
