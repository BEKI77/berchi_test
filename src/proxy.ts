import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Global Proxy: currently a no-op that lets all requests through.
//
// Auth and fine-grained authorization are enforced inside route
// handlers and layouts (e.g. (dashboard)/layout.tsx and per-page
// permission checks using hasPermission).

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
