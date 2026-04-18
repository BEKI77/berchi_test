import { NextResponse } from "next/server";
import { and, eq, gte, lte, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { salonSettings, appointments } from "@/db/schema";
import { auth } from "@/lib/auth";

const DEFAULT_HOURS: Record<string, { open: string; close: string }> = {
  monday: { open: "09:00", close: "20:00" },
  tuesday: { open: "09:00", close: "20:00" },
  wednesday: { open: "09:00", close: "20:00" },
  thursday: { open: "09:00", close: "20:00" },
  friday: { open: "09:00", close: "20:00" },
  saturday: { open: "09:00", close: "18:00" },
  sunday: { open: "closed", close: "closed" },
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SLOT_INTERVAL = 30;

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER" && session?.user?.role !== "CASHIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // YYYY-MM-DD

    if (!date) {
      return NextResponse.json({ error: "date parameter is required" }, { status: 400 });
    }

    const [settings] = await db.select().from(salonSettings).limit(1);
    let businessHours = DEFAULT_HOURS;
    if (settings?.businessHours) {
      try {
        businessHours = JSON.parse(settings.businessHours);
      } catch { /* use defaults */ }
    }

    const dateObj = new Date(`${date}T00:00:00`);
    const dayName = DAY_NAMES[dateObj.getDay()];
    const dayHours = businessHours[dayName];

    if (!dayHours || dayHours.open === "closed" || dayHours.close === "closed") {
      return NextResponse.json({ date, closed: true, dayName, slots: [] });
    }

    const [openH, openM] = dayHours.open.split(":").map(Number);
    const [closeH, closeM] = dayHours.close.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const appts = await db.query.appointments.findMany({
      where: and(
        gte(appointments.startTime, dayStart),
        lte(appointments.startTime, dayEnd),
        notInArray(appointments.status, ["CANCELLED", "NO_SHOW"]),
      ),
      with: {
        customer: { columns: { firstName: true, lastName: true } },
        service: { columns: { name: true, durationMinutes: true } },
      },
    });

    const slots = [];
    const now = new Date();
    const isToday = date === now.toISOString().split("T")[0];
    const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    for (let m = openMinutes; m < closeMinutes; m += SLOT_INTERVAL) {
      const slotStart = m;
      const slotEnd = m + SLOT_INTERVAL;

      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const time = `${hh}:${mm}`;

      const appointment = appts.find((a) => {
        const st = new Date(a.startTime);
        const startMin = st.getHours() * 60 + st.getMinutes();
        const duration = a.service?.durationMinutes || 30;
        const endMin = startMin + duration;
        return slotStart < endMin && slotEnd > startMin;
      });

      slots.push({
        time,
        label: `${Math.floor(m / 60) % 12 || 12}:${mm} ${Math.floor(m / 60) < 12 ? "AM" : "PM"}`,
        available: !appointment && (!isToday || slotStart > nowMinutes),
        status: appointment ? (appointment.status === "BLOCKED" ? "BLOCKED" : "BOOKED") : "AVAILABLE",
        appointment: appointment ? {
          id: appointment.id,
          customerName: `${appointment.customer.firstName} ${appointment.customer.lastName}`,
          serviceName: appointment.service.name,
          status: appointment.status,
        } : null,
      });
    }

    return NextResponse.json({
      date,
      dayName,
      openTime: dayHours.open,
      closeTime: dayHours.close,
      slots,
    });
  } catch (error) {
    console.error("Failed to fetch admin slots:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
