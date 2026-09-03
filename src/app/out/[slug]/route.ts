import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/userSession";
import { isInternalUser } from "@/lib/internalTraffic";
import { hashVisitor, clientIp } from "@/lib/visitorHash";
import { isLikelyBot } from "@/lib/botDetection";
import { advisoryLockKey } from "@/lib/dedup";
import { touchUserActivity } from "@/lib/userActivity";

export const dynamic = "force-dynamic";

// See DZIEŃ 1A report: covers double-click (sub-second) and a quick
// back-button bounce from the bank's site (typically well under a
// minute), without blocking a genuinely reconsidered second click a
// few minutes later, and never affects clicks on different promotions.
const CLICK_DEDUP_WINDOW_MS = 120_000;

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
 * the clicks table, not to track the visitor. `ipHash` (salted, no raw
 * IP) is used only for the short click-dedup window below.
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
  const userAgent = request.headers.get("user-agent") ?? "";

  // Clicking straight through to a bank's site from a page loaded earlier
  // (a different tab, or a page left open since yesterday) never re-fires
  // PageViewTracker, so without this the admin "aktywny/a" dot could sit
  // stale despite a click just having happened. Before the internal/bot
  // gate below — see touchUserActivity.
  if (currentUser) touchUserActivity(currentUser.id);

  // Never skip the redirect itself for internal traffic or obvious bots —
  // only the tracking write and notification are skipped, so testing the
  // actual affiliate link (or a legitimate crawler fetching it) still works.
  if (isInternalUser(currentUser?.email) || isLikelyBot(userAgent)) {
    return NextResponse.redirect(promotion.affiliateUrl, { status: 302 });
  }

  const ip = clientIp(request);
  const visitorHash = ip ? hashVisitor(ip, userAgent) : null;

  try {
    await db.$transaction(async (tx) => {
      if (visitorHash) {
        // Serializes concurrent requests from the same visitor for the
        // same promotion — a plain SELECT-then-INSERT is not race-safe
        // under two truly simultaneous identical requests, this is.
        // Transaction-scoped: releases automatically at commit/rollback,
        // safe with Neon's pooled connections.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockKey(promotion.id, visitorHash)})`;

        const recent = await tx.click.findFirst({
          where: {
            promotionId: promotion.id,
            ipHash: visitorHash,
            createdAt: { gte: new Date(Date.now() - CLICK_DEDUP_WINDOW_MS) }
          },
          select: { id: true }
        });
        if (recent) return; // duplicate within the window — skip silently
      }

      await tx.click.create({
        data: {
          promotionId: promotion.id,
          sessionId: randomUUID(),
          source: searchParams.get("src") ?? undefined,
          campaign: searchParams.get("cmp") ?? undefined,
          trafficSource: searchParams.get("traffic_source") ?? undefined,
          utmSource: searchParams.get("utm_source") ?? undefined,
          utmMedium: searchParams.get("utm_medium") ?? undefined,
          utmCampaign: searchParams.get("utm_campaign") ?? undefined,
          utmContent: searchParams.get("utm_content") ?? undefined,
          utmTerm: searchParams.get("utm_term") ?? undefined,
          ipHash: visitorHash,
          userId: currentUser?.id
        }
      });

      // Surface it to the admin as an in-app notification. Awaited (not
      // fire-and-forget) — on Vercel's serverless runtime, work left
      // running after the response is sent isn't guaranteed to finish.
      await tx.adminNotification.create({
        data: {
          type: "PROMOTION_CLICK",
          title: "Kliknięcie „Przejdź do promocji”",
          body: `${currentUser?.name || currentUser?.email || "Niezalogowany użytkownik"} kliknął/ęła „Przejdź do promocji” — ${promotion.bank.name}: ${promotion.name}.`,
          relatedUserId: currentUser?.id,
          relatedPromotionId: promotion.id
        }
      });
    });
  } catch {
    // Tracking must never block the redirect itself.
  }

  return NextResponse.redirect(promotion.affiliateUrl, { status: 302 });
}
