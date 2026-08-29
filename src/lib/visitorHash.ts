import { createHash } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Hashed, never the raw IP — a fixed pepper is enough here since the
 * goal is de-duplicating same-visitor hits (unique pageviews, and the
 * short-window click dedup in /out/[slug]), not cryptographic security.
 * Rotating this pepper would just reset the dedup window, which is
 * harmless. Mixing in the User-Agent fixes the most common source of
 * undercounting: a shared IP (office, family Wi-Fi, mobile carrier NAT)
 * no longer collapses several different real visitors into one.
 *
 * Shared between api/track/pageview and out/[slug] — same purpose
 * (identify "this visitor" without storing anything identifying), just
 * applied over different time windows for different reasons.
 */
export function hashVisitor(ip: string, userAgent: string): string {
  return createHash("sha256").update(`bankmiplaci-pageview-pepper:${ip}:${userAgent}`).digest("hex");
}

export function clientIp(request: NextRequest): string | null {
  // Behind a proxy/load balancer, the real client IP is the first entry
  // in X-Forwarded-For; fall back to X-Real-IP for single-proxy setups.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return (forwardedFor.split(",")[0] ?? forwardedFor).trim();
  return request.headers.get("x-real-ip");
}
