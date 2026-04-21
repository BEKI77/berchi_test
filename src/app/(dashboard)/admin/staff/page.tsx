import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewStaff = await hasPermission(session.user.id, "staff.view");
  if (!canViewStaff) {
    redirect("/");
  }

  return <StaffClient />;
}
