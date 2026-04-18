import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, customers, services, serviceCategories } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER" && session?.user?.role !== "CASHIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { date, slotTimes, startTime, endTime, reason } = body;

    if (!date || (!slotTimes && (!startTime || !endTime))) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Get or create "System" category
    let [systemCat] = await db.select().from(serviceCategories).where(eq(serviceCategories.name, "System")).limit(1);
    if (!systemCat) {
      [systemCat] = await db.insert(serviceCategories).values({ name: "System", description: "Internal system services" }).returning();
    }

    // 2. Get or create "Time Block" service
    let [blockSvc] = await db.select().from(services).where(eq(services.name, "Time Block")).limit(1);
    if (!blockSvc) {
      [blockSvc] = await db.insert(services).values({
        name: "Time Block",
        categoryId: systemCat.id,
        basePrice: "0",
        durationMinutes: 30,
      }).returning();
    }

    // 3. Get or create "Internal" customer
    let [internalCust] = await db.select().from(customers).where(eq(customers.lastName, "SYSTEM_BLOCK")).limit(1);
    if (!internalCust) {
      [internalCust] = await db.insert(customers).values({
        firstName: "Admin",
        lastName: "SYSTEM_BLOCK",
        phone: "0000000000",
      }).returning();
    }

    const appointmentsToCreate = [];

    if (slotTimes && Array.isArray(slotTimes)) {
      // Mode 1: Specific slots
      for (const time of slotTimes) {
        const start = new Date(`${date}T${time}:00`);
        const end = new Date(start.getTime() + 30 * 60000);
        appointmentsToCreate.push({
          customerId: internalCust.id,
          serviceId: blockSvc.id,
          startTime: start,
          endTime: end,
          status: "BLOCKED" as any,
          notes: reason || "Administrative Block",
          source: "MANUAL" as const,
        });
      }
    } else if (startTime && endTime) {
      // Mode 2: Range
      const start = new Date(`${date}T${startTime}:00`);
      const end = new Date(`${date}T${endTime}:00`);
      
      if (end <= start) {
        return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
      }

      appointmentsToCreate.push({
        customerId: internalCust.id,
        serviceId: blockSvc.id,
        startTime: start,
        endTime: end,
        status: "BLOCKED" as any,
        notes: reason || "Administrative Block",
        source: "MANUAL" as const,
      });
    }

    if (appointmentsToCreate.length > 0) {
      await db.insert(appointments).values(appointmentsToCreate);
    }

    return NextResponse.json({ success: true, count: appointmentsToCreate.length });
  } catch (error) {
    console.error("Failed to block slots:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
