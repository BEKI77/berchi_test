import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppointmentsClient } from "./appointments-client";

export default async function AppointmentsPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/");

  return <AppointmentsClient />;
}
