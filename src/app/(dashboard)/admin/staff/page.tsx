import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/");

  return <StaffClient />;
}
