import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/userSession";

const bodySchema = z.object({ promotionId: z.string().min(1), source: z.string().optional() });

/**
 * Fire-and-forget impression logging, called from PromotionImpression
 * (client component). No cookies or persistent identifiers are used
 * for anonymous visitors — sessionId here is a fresh random id per
 * request. If the visitor happens to be logged in, we additionally
 * attach their userId so the admin panel can show "what did this
 * user look at".
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const currentUser = await getCurrentUser();

  try {
    await db.impression.create({
      data: {
        promotionId: parsed.data.promotionId,
        sessionId: randomUUID(),
        source: parsed.data.source,
        userId: currentUser?.id
      }
    });
  } catch {
    // Never fail the page for an analytics write.
  }

  return NextResponse.json({ ok: true });
}
