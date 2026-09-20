// The rules for the stylists' shared-tablet PIN. No server imports here, so the
// tablet screen can use the same numbers the server enforces.

/** Digits in a PIN. The tablet submits by itself when this many are entered. */
export const PIN_LENGTH = 4;

/** Wrong PINs allowed before that stylist is locked out. */
export const MAX_PIN_ATTEMPTS = 5;

/** How long a lockout lasts. Setting a new PIN clears it at once. */
export const PIN_LOCK_MINUTES = 5;

/**
 * A shared tablet signs the stylist out after this long with no touch, so the
 * next person cannot work under their name.
 */
export const IDLE_LOCK_MINUTES = 3;

/** Idle time in milliseconds, honouring an optional PIN_IDLE_MINUTES override. */
export function idleLockMs(): number {
  const minutes = Number(process.env.PIN_IDLE_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : IDLE_LOCK_MINUTES) * 60_000;
}

/** Why a PIN was refused, or null if it is acceptable to set. */
export function pinProblem(pin: unknown): string | null {
  if (typeof pin !== "string" || !new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    return `The PIN must be exactly ${PIN_LENGTH} digits`;
  }
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]);
  if (steps.every((s) => s === 0)) return "Choose a PIN that is not all the same digit";
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1)) {
    return "Choose a PIN that is not a run of numbers like 1234";
  }
  return null;
}
