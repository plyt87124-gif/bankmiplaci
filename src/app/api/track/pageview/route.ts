import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID, createHash } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/userSession";

const bodySchema = z.object({ path: z.string().min(1).max(500) });

/**
 * Hashed, never the raw IP — a fixed pepper is enough here since the
 * goal is de-duplicating same-visitor hits for the "unikalne wejścia"
 * stat, not cryptographic security. Rotating this pepper would just
 * reset the dedup window, which is harmless.
 */
function hashIp(ip: string) {
  return createHash("sha256").update(`bankmiplaci-pageview-pepper:${ip}`).digest("hex");
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
  const ip = clientIp(request);

  try {
    await db.pageView.create({
      data: {
        path: parsed.data.path,
        sessionId: randomUUID(),
        ipHash: ip ? hashIp(ip) : null,
        userId: currentUser?.id
      }
    });
  } catch {
    // Never fail the page for an analytics write.
  }

  return NextResponse.json({ ok: true });
}
