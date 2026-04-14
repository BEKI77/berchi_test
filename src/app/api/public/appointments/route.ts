import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCors, handlePreflight } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handlePreflight(req);
}

// Public endpoint — no auth required. Creates customer if needed, then appointment with source=ONLINE
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  try {
    const body = await req.json();
    const { firstName, lastName, phone, email, serviceId, preferredDate, preferredTime, notes } = body;

    if (!firstName || !lastName || !phone || !serviceId || !preferredDate || !preferredTime) {
      return withCors(NextResponse.json(
        { error: "First name, last name, phone, service, date, and time are required" },
        { status: 400 }
      ), origin);
    }

    // Verify service exists
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return withCors(NextResponse.json({ error: "Service not found" }, { status: 400 }), origin);
    }

    // Find or create customer by phone number
    let customer = await prisma.customer.findFirst({
      where: { phone: phone.trim() },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
        },
      });
    }

    // Parse date + time
    const startTime = new Date(`${preferredDate}T${preferredTime}:00`);
    if (isNaN(startTime.getTime())) {
      return withCors(NextResponse.json({ error: "Invalid date or time" }, { status: 400 }), origin);
    }

    // Calculate end time
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60000);

    // Create appointment with source=ONLINE, no staff assigned yet
    // Using scalar fields to trigger UncheckedCreateInput (staffId is optional)
    const appointment = await prisma.appointment.create({
      data: {
        customerId: customer.id,
        serviceId,
        staffId: null,
        startTime,
        endTime,
        source: "ONLINE",
        status: "SCHEDULED",
        notes: notes?.trim() || null,
      },
    });

    return withCors(NextResponse.json({ success: true, appointmentId: appointment.id }), origin);
  } catch (error) {
    console.error("Public appointment booking error:", error);
    return withCors(NextResponse.json({ error: "Failed to book appointment" }, { status: 500 }), origin);
  }
}
