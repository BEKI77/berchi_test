import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const publicPrefixes = ["/login"];

const roleRoutes: Record<string, string[]> = {
  SERVER: ["/server"],
  CASHIER: ["/cashier"],
  OWNER: ["/admin", "/server", "/cashier"],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow exact root path (public website)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicPrefixes.some((route) => pathname.startsWith(route))) {
    // If already logged in and visiting login, redirect to home
    if (req.auth?.user && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Allow API routes and static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to login
  if (!req.auth?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const userRole = req.auth.user.role as string;
  const allowedPrefixes = roleRoutes[userRole] || [];

  // Root path is handled by the page itself (redirects based on role)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Check if the user's role allows access to this route
  const hasAccess = allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!hasAccess) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
