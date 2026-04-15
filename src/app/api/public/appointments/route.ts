import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services, customers, appointments } from "@/db/schema";
import { withCors, handlePreflight } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handlePreflight(req);
}

// Public endpoint — no auth required. Creates customer if needed, then appointment with source=ONLINE
export async function POST(req: Request) {
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
    const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
    if (!service) {
      return withCors(NextResponse.json({ error: "Service not found" }, { status: 400 }), origin);
    }

    // Find or create customer by phone number
    let [customer] = await db.select().from(customers).where(eq(customers.phone, phone.trim())).limit(1);
    if (!customer) {
      [customer] = await db
        .insert(customers)
        .values({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
        })
        .returning();
    }

    // Parse date + time
    const startTime = new Date(`${preferredDate}T${preferredTime}:00`);
    if (isNaN(startTime.getTime())) {
      return withCors(NextResponse.json({ error: "Invalid date or time" }, { status: 400 }), origin);
    }

    // Calculate end time
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60000);

    // Create appointment with source=ONLINE, no staff assigned yet
    const [appointment] = await db
      .insert(appointments)
      .values({
        customerId: customer.id,
        serviceId,
        staffId: null,
        startTime,
        endTime,
        source: "ONLINE",
        status: "SCHEDULED",
        notes: notes?.trim() || null,
      })
      .returning();

    return withCors(NextResponse.json({ success: true, appointmentId: appointment.id }), '*');
  } catch (error) {
    console.error("Public appointment booking error:", error);
    return withCors(NextResponse.json({ error: "Failed to book appointment" }, { status: 500 }), '*');
  }
}
