import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/");

  return <SettingsClient />;
}
