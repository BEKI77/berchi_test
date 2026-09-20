"use client";

import { useEffect } from "react";

/**
 * Opens the print dialog once the slip has rendered. The timer is cleared on
 * cleanup so React's development double-mount does not print twice.
 */
export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
