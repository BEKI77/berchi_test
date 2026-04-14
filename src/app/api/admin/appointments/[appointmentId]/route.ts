import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "OWNER" && session?.user?.role !== "CASHIER") {
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
      const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (!existing) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      const serviceId = body.serviceId || existing.serviceId;
      const startTime = body.startTime ? new Date(body.startTime) : existing.startTime;

      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      const endTime = service
        ? new Date(startTime.getTime() + service.durationMinutes * 60000)
        : null;

      if (body.serviceId) updateData.serviceId = body.serviceId;
      if (body.startTime) updateData.startTime = startTime;
      updateData.endTime = endTime;
    }

    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Failed to update appointment:", error);
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
  }
}
