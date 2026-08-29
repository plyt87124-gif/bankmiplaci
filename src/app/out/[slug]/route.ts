import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/userSession";
import { isInternalUser } from "@/lib/internalTraffic";

export const dynamic = "force-dynamic";

/**
 * GET /out/:slug
 *
 * The only place in the codebase that ever reads `promotion.affiliateUrl`.
 * Every "Przejdź do promocji" CTA points here instead of embedding the
 * partner link directly, so:
 *   - the real link can be swapped by an admin without a redeploy,
 *   - every outbound click is counted for the admin CTR report,
 *   - we can add rate limiting / consent checks in one place later.
 *
 * No cookies or persistent identifiers are set — `sessionId` here is a
 * one-off random id used only to de-duplicate this single request in
 * the clicks table, not to track the visitor.
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const promotion = await db.promotion.findUnique({
    where: { slug: params.slug },
    select: { id: true, name: true, affiliateUrl: true, status: true, bank: { select: { name: true } } }
  });

  if (!promotion) {
    return NextResponse.redirect(new URL("/promocje", request.url));
  }

  const { searchParams } = new URL(request.url);
  const currentUser = await getCurrentUser();

  // Never skip the redirect itself for internal traffic — only the
  // tracking write and notification are skipped, so testing the actual
  // affiliate link still works, it just doesn't pollute the stats.
  if (isInternalUser(currentUser?.email)) {
    return NextResponse.redirect(promotion.affiliateUrl, { status: 302 });
  }

  try {
    await db.click.create({
      data: {
        promotionId: promotion.id,
        sessionId: randomUUID(),
        source: searchParams.get("src") ?? undefined,
        campaign: searchParams.get("cmp") ?? undefined,
        userId: currentUser?.id
      }
    });

    // Surface it to the admin as an in-app notification. Awaited (not
    // fire-and-forget) — on Vercel's serverless runtime, work left
    // running after the response is sent isn't guaranteed to finish.
    await db.adminNotification.create({
      data: {
        type: "PROMOTION_CLICK",
        title: "Kliknięcie „Przejdź do promocji”",
        body: `${currentUser?.name || currentUser?.email || "Niezalogowany użytkownik"} kliknął/ęła „Przejdź do promocji” — ${promotion.bank.name}: ${promotion.name}.`,
        relatedUserId: currentUser?.id,
        relatedPromotionId: promotion.id
      }
    });
  } catch {
    // Tracking must never block the redirect itself.
  }

  return NextResponse.redirect(promotion.affiliateUrl, { status: 302 });
}
