import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewSettings = await hasPermission(session.user.id, "settings.view");
  if (!canViewSettings) {
    redirect("/");
  }

  return <SettingsClient />;
}
