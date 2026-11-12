import { db } from "@/lib/db";
import { sameClientKind } from "@/lib/accountTypes";
import { mostRestrictiveHistory } from "@/lib/services/eligibility";
import { activeWhere } from "@/lib/services/promotions";

/** Why an offer card shows the "front layer" for this visitor. */
export type EligibilityMark =
  | { slug: string; reason: "client" }
  | { slug: string; reason: "karencja"; until: string | null }
  | { slug: string; reason: "joined" };

/**
 * What a signed-in visitor should be told on top of each open offer:
 *   client    the user said they are a CURRENT client of this bank (same kind of account): all of that bank's offers
 *             of that kind are closed to them, with or without a karencja rule. A young account counts as a
 *             personal one here and in the karencja rule (accountTypes.ts, clientKindOf); the offer card keeps its
 *             real "Konto dla młodych" badge;
 *   karencja  the closure date they gave fails the offer's karencja rule (`until` = the day they qualify, null for a
 *             fixed cut-off that never resolves);
 *   joined    they already have this offer's ściąga open (informational, not a block).
 * "No data" is never a mark: no date, no rule, or an unknown rule gives nothing.
 */
export async function listEligibilityMarks(userId: string, now: Date = new Date()): Promise<EligibilityMark[]> {
  const [history, tracked] = await Promise.all([
    db.userBankHistory.findMany({
      where: { userId, OR: [{ wasClientUntil: { not: null } }, { wasClientFrom: { not: null } }] },
      select: { bankId: true, accountType: true, wasClientFrom: true, wasClientUntil: true }
    }),
    db.userPromotionTracking.findMany({
      where: { userId, completedAt: null },
      select: { promotion: { select: { slug: true } } }
    })
  ]);

  const marks = new Map<string, EligibilityMark>();

  if (history.length > 0) {
    const promotions = await db.promotion.findMany({
      where: { ...activeWhere(), bankId: { in: [...new Set(history.map((h) => h.bankId))] } },
      select: { slug: true, bankId: true, accountType: true, cooldownMonths: true, cooldownCutoffDate: true }
    });
    for (const promotion of promotions) {
      // Every row that counts as the same account for this offer; the one that stands in the way decides.
      const rows = history.filter((h) => h.bankId === promotion.bankId && sameClientKind(h.accountType, promotion.accountType));
      const worst = mostRestrictiveHistory(rows, promotion, now);
      if (!worst) continue;
      const result = worst.result;
      if (result.status !== "not-eligible") continue;
      if (result.currentClient) marks.set(promotion.slug, { slug: promotion.slug, reason: "client" });
      else {
        marks.set(promotion.slug, {
          slug: promotion.slug,
          reason: "karencja",
          until: !result.cutoffFailed && result.eligibleFromDate ? result.eligibleFromDate.toISOString() : null
        });
      }
    }
  }

  for (const t of tracked) {
    const slug = t.promotion.slug;
    if (!marks.has(slug)) marks.set(slug, { slug, reason: "joined" });
  }
  return [...marks.values()];
}

/**
 * Slugs of the open offers this user cannot take part in right now (a "client" or "karencja" mark; "joined" is not
 * a block). Feeds the "only those I can join" filter.
 */
export async function listBlockedPromotionSlugs(userId: string, now: Date = new Date()): Promise<string[]> {
  const marks = await listEligibilityMarks(userId, now);
  return marks.filter((m) => m.reason !== "joined").map((m) => m.slug);
}
