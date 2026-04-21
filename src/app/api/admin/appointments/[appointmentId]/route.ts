import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { appointments, services } from "@/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canUpdate = await hasPermission(session.user.id, "appointments.update");
  if (!canUpdate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { appointmentId } = await params;
    const body = await req.json();

    // Build safe update data — only allow specific fields
    const updateData: Record<string, unknown> = {};

    if (body.status) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.staffId !== undefined) updateData.staffId = body.staffId || null;

    // If startTime or serviceId changed, recalculate endTime
    if (body.startTime || body.serviceId) {
      const [existing] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
      if (!existing) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      const serviceId = body.serviceId || existing.serviceId;
      const startTime = body.startTime ? new Date(body.startTime) : existing.startTime;

      const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
      const endTime = service
        ? new Date(startTime.getTime() + service.durationMinutes * 60000)
        : null;

      if (body.serviceId) updateData.serviceId = body.serviceId;
      if (body.startTime) updateData.startTime = startTime;
      updateData.endTime = endTime;
    }

    await db.update(appointments).set(updateData).where(eq(appointments.id, appointmentId));

    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
      with: {
        customer: { columns: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { columns: { id: true, firstName: true, lastName: true } },
        service: { columns: { id: true, name: true, durationMinutes: true } },
      },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Failed to update appointment:", error);
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
  }
}
