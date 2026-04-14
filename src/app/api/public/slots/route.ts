import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCors, handlePreflight } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handlePreflight(req);
}

// Default working hours if none configured
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

// Slot interval in minutes
const SLOT_INTERVAL = 30;

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // YYYY-MM-DD
    const serviceId = searchParams.get("serviceId");

    if (!date) {
      return NextResponse.json({ error: "date parameter is required" }, { status: 400 });
    }

    // Get service duration (default 30 min if not provided)
    let serviceDuration = SLOT_INTERVAL;
    if (serviceId) {
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (service) {
        serviceDuration = service.durationMinutes;
      }
    }

    // Get working hours from salon settings
    const settings = await prisma.salonSettings.findFirst();
    let businessHours = DEFAULT_HOURS;
    if (settings?.businessHours) {
      try {
        businessHours = JSON.parse(settings.businessHours);
      } catch {
        // use defaults
      }
    }

    // Determine day of week
    const dateObj = new Date(`${date}T00:00:00`);
    const dayName = DAY_NAMES[dateObj.getDay()];
    const dayHours = businessHours[dayName];

    // If closed on this day
    if (!dayHours || dayHours.open === "closed" || dayHours.close === "closed") {
      return NextResponse.json({
        date,
        closed: true,
        dayName,
        slots: [],
      });
    }

    // Parse open/close hours
    const [openH, openM] = dayHours.open.split(":").map(Number);
    const [closeH, closeM] = dayHours.close.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    // Generate all possible slots
    const slots: { time: string; label: string; available: boolean }[] = [];

    // Get all appointments for this date (not cancelled)
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const appointments = await prisma.appointment.findMany({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: {
        startTime: true,
        endTime: true,
        service: { select: { durationMinutes: true } },
      },
    });

    // Build occupied ranges (in minutes from midnight)
    const occupied: { start: number; end: number }[] = appointments.map((a) => {
      const st = new Date(a.startTime);
      const startMin = st.getHours() * 60 + st.getMinutes();
      let endMin: number;
      if (a.endTime) {
        const et = new Date(a.endTime);
        endMin = et.getHours() * 60 + et.getMinutes();
      } else {
        endMin = startMin + (a.service?.durationMinutes || 30);
      }
      return { start: startMin, end: endMin };
    });

    // Current time check (can't book past slots for today)
    const now = new Date();
    const isToday = date === now.toISOString().split("T")[0];
    const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    // Generate slots at SLOT_INTERVAL intervals
    for (let m = openMinutes; m + serviceDuration <= closeMinutes; m += SLOT_INTERVAL) {
      const slotStart = m;
      const slotEnd = m + serviceDuration;

      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const time = `${hh}:${mm}`;

      // Format label (12h)
      const hour12 = Math.floor(m / 60) % 12 || 12;
      const ampm = Math.floor(m / 60) < 12 ? "AM" : "PM";
      const label = `${hour12}:${mm} ${ampm}`;

      // Check if this slot overlaps any existing appointment
      const isOccupied = occupied.some(
        (occ) => slotStart < occ.end && slotEnd > occ.start
      );

      // Check if slot is in the past (for today)
      const isPast = isToday && slotStart <= nowMinutes;

      slots.push({
        time,
        label,
        available: !isOccupied && !isPast,
      });
    }

    return withCors(NextResponse.json({
      date,
      dayName,
      closed: false,
      openTime: dayHours.open,
      closeTime: dayHours.close,
      serviceDuration,
      slots,
    }), origin);
  } catch (error) {
    console.error("Failed to get slots:", error);
    return withCors(NextResponse.json({ error: "Failed to get available slots" }, { status: 500 }), origin);
  }
}
