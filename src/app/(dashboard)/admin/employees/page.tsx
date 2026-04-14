import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmployeesClient } from "./employees-client";

export default async function EmployeesPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    redirect("/");
  }

  return <EmployeesClient />;
}
