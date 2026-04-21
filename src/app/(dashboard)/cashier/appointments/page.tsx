import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { AppointmentsClient } from "../../admin/appointments/appointments-client";

export default async function CashierAppointmentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewAppointments = await hasPermission(session.user.id, "appointments.view");
  if (!canViewAppointments) {
    redirect("/");
  }

  return <AppointmentsClient />;
}
