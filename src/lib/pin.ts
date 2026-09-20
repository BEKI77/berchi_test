import bcrypt from "bcryptjs";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { staff, staffPinAttempts } from "@/db/schema";
import { MAX_PIN_ATTEMPTS, PIN_LENGTH, PIN_LOCK_MINUTES } from "./pin-config";
import type { SessionUser } from "@/types";

/**
 * PIN sign-in is for the shared stylist tablet on the salon PC. It is OFF unless
 * ENABLE_PIN_LOGIN=true, so the internet-facing cloud app never offers it: a
 * short PIN is only acceptable behind the salon's own Wi-Fi.
 */
export function pinLoginEnabled(): boolean {
  return process.env.ENABLE_PIN_LOGIN === "true";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN_SHAPE = new RegExp(`^\\d{${PIN_LENGTH}}$`);

// Compared against when the stylist does not exist, so refusing an unknown
// name takes as long as refusing a wrong PIN and does not reveal which it was.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-pin", 10);

export async function setStaffPin(staffId: string, pin: string): Promise<void> {
  const pinHash = await bcrypt.hash(pin, 10);
  await db.transaction(async (tx) => {
    await tx.update(staff).set({ pinHash }).where(eq(staff.id, staffId));
    // A new PIN is how the owner unlocks someone, so it also clears the count.
    await tx.delete(staffPinAttempts).where(eq(staffPinAttempts.staffId, staffId));
  });
}

export async function clearStaffPin(staffId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(staff).set({ pinHash: null }).where(eq(staff.id, staffId));
    await tx.delete(staffPinAttempts).where(eq(staffPinAttempts.staffId, staffId));
  });
}

export type PinResult =
  | { status: "ok"; user: SessionUser }
  | { status: "invalid" }
  | { status: "wrong"; triesLeft: number }
  | { status: "locked"; retryAt: Date };

/**
 * Checks a stylist's PIN. Only ever succeeds for an active SERVER account with a
 * PIN set: a PIN can open the stylist screens and nothing else, so a guessed one
 * never reaches money or admin.
 */
export async function verifyStaffPin(staffId: unknown, pin: unknown): Promise<PinResult> {
  if (typeof staffId !== "string" || !UUID.test(staffId) || typeof pin !== "string" || !PIN_SHAPE.test(pin)) {
    return { status: "invalid" };
  }

  return db.transaction(async (tx): Promise<PinResult> => {
    const [member] = await tx.select().from(staff).where(eq(staff.id, staffId)).limit(1);
    if (!member || member.role !== "SERVER" || !member.isActive || !member.pinHash) {
      await bcrypt.compare(pin, DUMMY_HASH);
      return { status: "invalid" };
    }

    // One row per stylist, locked for the rest of this transaction. Guesses for
    // the same person queue up here, so firing many at once cannot buy extra
    // tries beyond the limit.
    await tx.insert(staffPinAttempts).values({ staffId }).onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(staffPinAttempts)
      .where(eq(staffPinAttempts.staffId, staffId))
      .for("update");

    const now = new Date();
    if (row.lockedUntil && row.lockedUntil > now) {
      return { status: "locked", retryAt: row.lockedUntil };
    }

    if (await bcrypt.compare(pin, member.pinHash)) {
      if (row.failedCount !== 0 || row.lockedUntil) {
        await tx
          .update(staffPinAttempts)
          .set({ failedCount: 0, lockedUntil: null })
          .where(eq(staffPinAttempts.staffId, staffId));
      }
      return {
        status: "ok",
        user: {
          id: member.id,
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          role: member.role,
        },
      };
    }

    const failed = row.failedCount + 1;
    if (failed >= MAX_PIN_ATTEMPTS) {
      const retryAt = new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000);
      await tx
        .update(staffPinAttempts)
        .set({ failedCount: 0, lockedUntil: retryAt })
        .where(eq(staffPinAttempts.staffId, staffId));
      return { status: "locked", retryAt };
    }
    await tx.update(staffPinAttempts).set({ failedCount: failed }).where(eq(staffPinAttempts.staffId, staffId));
    return { status: "wrong", triesLeft: MAX_PIN_ATTEMPTS - failed };
  });
}

/**
 * The names shown on the tablet's picker: active stylists who have a PIN. Only a
 * first name and last initial (the full last name only if two would look alike),
 * and never an email or anything else.
 */
export async function listPinStaff(): Promise<{ id: string; name: string; locked: boolean }[]> {
  const rows = await db
    .select({
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      lockedUntil: staffPinAttempts.lockedUntil,
    })
    .from(staff)
    .leftJoin(staffPinAttempts, eq(staffPinAttempts.staffId, staff.id))
    .where(and(eq(staff.role, "SERVER"), eq(staff.isActive, true), isNotNull(staff.pinHash)))
    .orderBy(asc(staff.firstName), asc(staff.lastName));

  const now = new Date();
  const initialName = (r: { firstName: string; lastName: string }) =>
    `${r.firstName} ${r.lastName.trim()[0] ?? ""}.`.trim();
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(initialName(r), (counts.get(initialName(r)) ?? 0) + 1);

  return rows.map((r) => ({
    id: r.id,
    name: (counts.get(initialName(r)) ?? 0) > 1 ? `${r.firstName} ${r.lastName}` : initialName(r),
    locked: !!r.lockedUntil && r.lockedUntil > now,
  }));
}
