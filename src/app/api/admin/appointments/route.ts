import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER" && session?.user?.role !== "CASHIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const appointments = await prisma.appointment.findMany({
      orderBy: { startTime: "desc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        source: true,
        notes: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
    });
    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER" && session?.user?.role !== "CASHIER") {
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
      const customer = await prisma.customer.create({
        data: { firstName, lastName, phone: phone || null, email: email || null },
      });
      resolvedCustomerId = customer.id;
    }

    if (!resolvedCustomerId || !serviceId || !startTime) {
      return NextResponse.json({ error: "Customer, service, and time are required" }, { status: 400 });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const endTime = service
      ? new Date(new Date(startTime).getTime() + service.durationMinutes * 60000)
      : null;

    const appointment = await prisma.appointment.create({
      data: {
        customerId: resolvedCustomerId,
        staffId: staffId || null,
        serviceId,
        startTime: new Date(startTime),
        endTime,
        source: "MANUAL",
        notes: notes || null,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        source: true,
        notes: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Failed to create appointment:", error);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
