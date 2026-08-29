import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID, createHash } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/userSession";
import { isInternalUser } from "@/lib/internalTraffic";

const bodySchema = z.object({ path: z.string().min(1).max(500), source: z.string().max(200).optional() });

/**
 * Hashed, never the raw IP — a fixed pepper is enough here since the
 * goal is de-duplicating same-visitor hits for the "unikalne wejścia"
 * stat, not cryptographic security. Rotating this pepper would just
 * reset the dedup window, which is harmless.
 *
 * Mixing in the User-Agent (still nothing stored on the visitor's
 * device — it's just a request header the browser already sends on
 * every request) fixes the most common source of undercounting: a
 * shared IP (office, family Wi-Fi, mobile carrier NAT) no longer
 * collapses several different real visitors into one. It doesn't
 * (and can't, without a persistent client-side identifier, which
 * would need cookie consent) distinguish the same visitor switching
 * networks — that's a hard limit of any cookie-less approach.
 */
function hashVisitor(ip: string, userAgent: string) {
  return createHash("sha256").update(`bankmiplaci-pageview-pepper:${ip}:${userAgent}`).digest("hex");
}

function clientIp(request: NextRequest): string | null {
  // Behind a proxy/load balancer, the real client IP is the first entry
  // in X-Forwarded-For; fall back to X-Real-IP for single-proxy setups.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return (forwardedFor.split(",")[0] ?? forwardedFor).trim();
  return request.headers.get("x-real-ip");
}

/**
 * Fire-and-forget site-wide page view, mirroring the promotion-specific
 * Impression tracker in api/track/impression. No cookies — sessionId is
 * a fresh random id per request, ipHash is a salted hash used only to
 * count unique visitors, never the IP itself.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const currentUser = await getCurrentUser();
  if (isInternalUser(currentUser?.email)) return NextResponse.json({ ok: true });

  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";

  try {
    await db.pageView.create({
      data: {
        path: parsed.data.path,
        sessionId: randomUUID(),
        ipHash: ip ? hashVisitor(ip, userAgent) : null,
        source: parsed.data.source,
        userId: currentUser?.id
      }
    });
  } catch {
    // Never fail the page for an analytics write.
  }

  return NextResponse.json({ ok: true });
}
