"use client";

import { useEffect, useRef } from "react";

// If the stream is down, fall back to a slow poll so a screen is never stuck
// showing stale tickets. Healthy connections never trigger it.
const FALLBACK_POLL_MS = 30_000;

/**
 * Calls `onChange` when any ticket changes, and once whenever the connection is
 * (re)established, so nothing missed while offline stays missed.
 */
export function useOrderEvents(onChange: () => void) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    let connected = false;
    const source = new EventSource("/api/orders/events");

    source.onopen = () => {
      connected = true;
      latest.current();
    };
    source.addEventListener("changed", () => latest.current());
    source.onerror = () => {
      connected = false; // EventSource reconnects on its own
    };

    const fallback = setInterval(() => {
      if (!connected) latest.current();
    }, FALLBACK_POLL_MS);

    return () => {
      clearInterval(fallback);
      source.close();
    };
  }, []);
}
