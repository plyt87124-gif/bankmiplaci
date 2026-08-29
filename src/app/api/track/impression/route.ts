import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/userSession";
import { isInternalUser } from "@/lib/internalTraffic";

const bodySchema = z.object({
  promotionId: z.string().min(1),
  source: z.string().optional(),
  trafficSource: z.string().max(200).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional()
});

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
  if (isInternalUser(currentUser?.email)) return NextResponse.json({ ok: true });

  try {
    await db.impression.create({
      data: {
        promotionId: parsed.data.promotionId,
        sessionId: randomUUID(),
        source: parsed.data.source,
        trafficSource: parsed.data.trafficSource,
        utmSource: parsed.data.utmSource,
        utmMedium: parsed.data.utmMedium,
        utmCampaign: parsed.data.utmCampaign,
        utmContent: parsed.data.utmContent,
        utmTerm: parsed.data.utmTerm,
        userId: currentUser?.id
      }
    });

    // Surface it to the admin as an in-app notification (its own bell —
    // see NotificationBell in the admin layout). Best-effort: a lookup
    // failure here must never affect the impression write above.
    const promotion = await db.promotion.findUnique({
      where: { id: parsed.data.promotionId },
      select: { name: true, bank: { select: { name: true } } }
    });
    if (promotion) {
      await db.adminNotification.create({
        data: {
          type: "PROMOTION_VIEW",
          title: "Wejście na stronę promocji",
          body: `${currentUser?.name || currentUser?.email || "Niezalogowany użytkownik"} wszedł/a na stronę promocji — ${promotion.bank.name}: ${promotion.name}.`,
          relatedUserId: currentUser?.id,
          relatedPromotionId: parsed.data.promotionId
        }
      });
    }
  } catch {
    // Never fail the page for an analytics write.
  }

  return NextResponse.json({ ok: true });
}
