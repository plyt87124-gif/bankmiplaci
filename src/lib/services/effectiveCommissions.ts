import { db } from "@/lib/db";
import { effectiveCommissionCents } from "@/lib/effectiveCommission";

/**
 * Commission + contest per client (grosze, see lib/effectiveCommission.ts) of
 * every promotion that has at least one campaign linked in the affiliate
 * tables, keyed by promotion id and by slug. Promotions without a campaign are
 * absent (unknown, not zero): callers fall back to the commission stored on the
 * promotion itself, else treat it as unknown.
 *
 * Contests count only inside their period (isContestRunning), judged at `now`.
 *
 * Read-only, two small queries. Used by the rating (services/ratings.ts) and by
 * the "Polecane" order, so both read the same number.
 */
export interface EffectiveCommissions {
  byId: Map<string, number>;
  bySlug: Map<string, number>;
}

export async function loadEffectiveCommissions(
  filter: { slugs?: readonly string[] } = {},
  now: Date = new Date()
): Promise<EffectiveCommissions> {
  const offers = await db.affiliateOffer.findMany({
    where: {
      missingSince: null,
      promotionId: { not: null },
      ...(filter.slugs ? { promotion: { slug: { in: [...filter.slugs] } } } : {})
    },
    select: {
      network: true,
      externalId: true,
      cpsCents: true,
      cpaCents: true,
      missingSince: true,
      promotion: { select: { id: true, slug: true } }
    }
  });
  const result: EffectiveCommissions = { byId: new Map(), bySlug: new Map() };
  if (offers.length === 0) return result;

  const contests = await db.affiliateContest.findMany({
    where: { missingSince: null },
    select: { network: true, offerExternalIds: true, tiers: true, missingSince: true, startDate: true, endDate: true }
  });

  const byPromotion = new Map<string, { slug: string; offers: typeof offers }>();
  for (const o of offers) {
    if (!o.promotion) continue;
    const entry = byPromotion.get(o.promotion.id) ?? { slug: o.promotion.slug, offers: [] };
    entry.offers.push(o);
    byPromotion.set(o.promotion.id, entry);
  }
  for (const [id, entry] of byPromotion) {
    const cents = effectiveCommissionCents(entry.offers, contests, now);
    if (cents === null) continue;
    result.byId.set(id, cents);
    result.bySlug.set(entry.slug, cents);
  }
  return result;
}
