import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/userSession";
import { isInternalUser } from "@/lib/internalTraffic";
import { hashVisitor, clientIp } from "@/lib/visitorHash";

const bodySchema = z.object({ path: z.string().min(1).max(500), source: z.string().max(200).optional() });

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
