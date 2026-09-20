import { NextResponse } from "next/server";
import { listPinStaff, pinLoginEnabled } from "@/lib/pin";
import { PIN_LENGTH } from "@/lib/pin-config";

// Never cache: a lock or a new PIN must show on the tablet straight away.
export const dynamic = "force-dynamic";

// GET: The names on the shared tablet's picker. Public on purpose -- it is what
// the sign-in screen shows before anyone has signed in -- so it gives a first
// name and last initial and nothing else, and 404s unless PIN sign-in is turned
// on for this installation.
export async function GET() {
  if (!pinLoginEnabled()) {
    return NextResponse.json({ error: "PIN sign-in is not turned on" }, { status: 404 });
  }
  return NextResponse.json(
    { pinLength: PIN_LENGTH, staff: await listPinStaff() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
