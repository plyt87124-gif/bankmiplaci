import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { expiredIndexWindowStart } from "@/lib/promotionAvailability";
import { getBankCards } from "@/lib/services/promotionCards";
import { getPromotionBySlug } from "@/lib/services/promotions";
import { getCurrentUser } from "@/lib/userSession";

/**
 * Loaders of the offer page. `cache()` de-duplicates inside ONE request, so
 * generateMetadata and the page itself read the offer from the database once.
 * (Not a cross-request cache: the offer, its availability and the signed-in
 * user's data are still read per request - see the note on `revalidate` in
 * page.tsx.)
 *
 * `getOffer` returns the PUBLIC shape only: stripPrivateFields has already
 * removed the partner commission, and the page never selects `affiliateUrl`
 * into anything it renders.
 */
export const getOffer = cache((slug: string) => getPromotionBySlug(slug));

/** The signed-in visitor (user session), or null. */
export const getViewer = cache(() => getCurrentUser());

/** Is an admin signed in to the panel? Only they may see a DRAFT offer. */
export const isAdminViewer = cache(async (): Promise<boolean> => Boolean(await getServerSession(authOptions)));

export type OfferRow = NonNullable<Awaited<ReturnType<typeof getOffer>>>;

/** The visitor's closure date for this bank and account type (eligibility banner), or null. */
export function getBankHistory(userId: string, bankId: string, accountType: OfferRow["accountType"]) {
  return db.userBankHistory.findUnique({
    where: { userId_bankId_accountType: { userId, bankId, accountType } }
  });
}

/** The visitor's ściąga on this offer (joined / completed), or null. */
export function getTracking(userId: string, promotionId: string) {
  return db.userPromotionTracking.findUnique({
    where: { userId_promotionId: { userId, promotionId } }
  });
}

/** Does the offer have a ściąga at all? Built out per promotion (ChecklistStep seed data). */
export function countChecklistSteps(promotionId: string): Promise<number> {
  return db.checklistStep.count({ where: { promotionId } });
}

/**
 * Deep-dive guide for this specific promotion, if one has been written and
 * linked (Article.promotionId): internal linking for SEO, works for every
 * future promotion + article pair.
 */
export function getRelatedArticle(promotionId: string) {
  return db.article.findFirst({
    where: { promotionId, published: true },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, excerpt: true }
  });
}

/** The bank's current offers in the "Polecane" order (public cards, no partner link or commission). */
export const getOffersOfBank = cache((bankSlug: string) => getBankCards(bankSlug));

/** Slugs for generateStaticParams: open or recently ended offers only; never fails the build. */
export async function listIndexableSlugs(): Promise<string[]> {
  try {
    const rows = await db.promotion.findMany({
      where: { status: { in: ["ACTIVE", "EXPIRED"] }, endDate: { gte: expiredIndexWindowStart() } },
      select: { slug: true }
    });
    return rows.map((row) => row.slug);
  } catch {
    return [];
  }
}
