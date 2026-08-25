import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * In-memory rate limiter. This is intentionally simple and is scoped
 * per server instance/edge region — it stops naive abuse and buys time,
 * but is NOT a substitute for a shared store in a real multi-instance
 * deployment. Before scaling past a single instance, replace this with
 * Upstash Ratelimit (Redis) or a similar shared-state limiter.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, limit: number = MAX_REQUESTS): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Rate limiting for outbound affiliate redirects and API routes ---
  if (pathname.startsWith("/out/") || pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(`${ip}:${pathname.split("/")[1]}`)) {
      return new NextResponse("Zbyt wiele żądań. Spróbuj ponownie za chwilę.", { status: 429 });
    }
  }

  // --- Stricter limit on auth endpoints (brute-force / registration abuse) ---
  if (pathname.startsWith("/api/account/login") || pathname.startsWith("/api/account/register")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(`auth:${ip}`, 10)) {
      return new NextResponse("Zbyt wiele prób. Spróbuj ponownie za kilka minut.", { status: 429 });
    }
  }

  // --- Defense-in-depth admin guard (the layout also checks server-side) ---
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/logowanie")) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL("/admin/logowanie", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();

  // --- Baseline security headers ---
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/out/:path*", "/api/:path*"]
};
