import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PermissionsClient } from "./permissions-client";

export default async function PermissionsPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/");

  return <PermissionsClient />;
}
