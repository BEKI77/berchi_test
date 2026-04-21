import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, desc, not, inArray } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { appointments, customers, services } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await hasPermission(session.user.id, "appointments.view");
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get SYSTEM_BLOCK customer IDs to exclude
    const systemBlockCustomers = await db.select({ id: customers.id })
      .from(customers)
      .where(eq(customers.lastName, "SYSTEM_BLOCK"));
    
    const systemBlockCustomerIds = systemBlockCustomers.map(c => c.id);

    const result = await db.query.appointments.findMany({
      where: systemBlockCustomerIds.length > 0 ? 
        not(inArray(appointments.customerId, systemBlockCustomerIds)) : undefined,
      orderBy: [desc(appointments.startTime)],
      columns: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        source: true,
        notes: true,
      },
      with: {
        customer: { columns: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { columns: { id: true, firstName: true, lastName: true } },
        service: { columns: { id: true, name: true, durationMinutes: true } },
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canCreate = await hasPermission(session.user.id, "appointments.create");
  if (!canCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { customerId, newCustomer, staffId, serviceId, startTime, notes } = body;

    // Either customerId or newCustomer must be provided
    let resolvedCustomerId = customerId;

    if (!resolvedCustomerId && newCustomer) {
      const { firstName, lastName, phone, email } = newCustomer;
      if (!firstName || !lastName) {
        return NextResponse.json({ error: "New customer first and last name required" }, { status: 400 });
      }
      const [customer] = await db
        .insert(customers)
        .values({ firstName, lastName, phone: phone || null, email: email || null })
        .returning();
      resolvedCustomerId = customer.id;
    }

    if (!resolvedCustomerId || !serviceId || !startTime) {
      return NextResponse.json({ error: "Customer, service, and time are required" }, { status: 400 });
    }

    const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
    const endTime = service
      ? new Date(new Date(startTime).getTime() + service.durationMinutes * 60000)
      : null;

    const [appointment] = await db
      .insert(appointments)
      .values({
        customerId: resolvedCustomerId,
        staffId: staffId || null,
        serviceId,
        startTime: new Date(startTime),
        endTime,
        source: "MANUAL",
        notes: notes || null,
      })
      .returning();

    const fullAppointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointment.id),
      columns: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        source: true,
        notes: true,
      },
      with: {
        customer: { columns: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { columns: { id: true, firstName: true, lastName: true } },
        service: { columns: { id: true, name: true, durationMinutes: true } },
      },
    });

    return NextResponse.json(fullAppointment);
  } catch (error) {
    console.error("Failed to create appointment:", error);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
