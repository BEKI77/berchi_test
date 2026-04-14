import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppointmentsClient } from "../../admin/appointments/appointments-client";

export default async function CashierAppointmentsPage() {
  const session = await auth();
  if (session?.user?.role !== "CASHIER" && session?.user?.role !== "OWNER") {
    redirect("/");
  }

  return <AppointmentsClient />;
}
