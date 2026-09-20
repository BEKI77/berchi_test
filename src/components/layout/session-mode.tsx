"use client";

import { createContext, useContext, useEffect } from "react";
import { signOut } from "next-auth/react";

const SessionModeContext = createContext({ pinSession: false });

/** True when this session was opened with a PIN on the shared stylist tablet. */
export function useSessionMode() {
  return useContext(SessionModeContext);
}

/**
 * Signs the stylist out and returns the tablet to the name picker, ready for the
 * next person. A full page load rather than a client navigation, so nothing of
 * the last stylist's screen survives in memory.
 */
export async function endTabletSession(reason?: "idle") {
  try {
    await signOut({ redirect: false });
  } finally {
    window.location.assign(reason ? `/tablet?reason=${reason}` : "/tablet");
  }
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

/**
 * Wraps the signed-in screens. For a PIN session only, it signs out after
 * `idleMs` with no touch, so a tablet left on the counter cannot be used under
 * the last stylist's name. Any other session is left alone.
 */
export function SessionModeProvider({
  pinSession,
  idleMs,
  children,
}: {
  pinSession: boolean;
  idleMs: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!pinSession) return;

    let timer: ReturnType<typeof setTimeout>;
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => endTabletSession("idle"), idleMs);
    };

    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, restart, { passive: true });
    restart();
    return () => {
      clearTimeout(timer);
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, restart);
    };
  }, [pinSession, idleMs]);

  return <SessionModeContext.Provider value={{ pinSession }}>{children}</SessionModeContext.Provider>;
}
