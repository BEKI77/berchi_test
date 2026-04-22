import { NextResponse } from "next/server";
import "dotenv/config";

const ALLOWED_ORIGINS = [
  process.env.WEBSITE_URL, // e.g. https://berchi.com
  "https://berchibeauty.com", // production website
  "http://localhost:3001", // local website dev
  "http://localhost:3002",
  "*",
].filter(Boolean);

export function corsHeaders(origin?: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  // Allow any origin in dev, or specific origins in production
  if (process.env.NODE_ENV === "development") {
    headers["Access-Control-Allow-Origin"] = origin || "*";
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function withCors(response: NextResponse, origin?: string | null) {
  const headers = corsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function handlePreflight(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
