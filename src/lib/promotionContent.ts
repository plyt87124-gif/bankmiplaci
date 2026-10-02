/**
 * Decides whether a write actually changed what the public promotion page
 * shows, so Promotion.contentUpdatedAt (and with it the sitemap <lastmod>)
 * moves only on a real content change:
 *
 *   - real edit                      -> snapshots differ  -> bump
 *   - save in the admin with no edit -> snapshots equal   -> no bump
 *   - re-import of identical data    -> snapshots equal   -> no bump
 *   - recomputeRatings()             -> writes only `rating`, which is not
 *                                       part of the snapshot, and never
 *                                       touches contentUpdatedAt at all
 *
 * Both sides (a row loaded from the DB and form/import input) are reduced
 * to the same canonical shape before being compared: null/undefined/""
 * are the same "empty", dates compare as ISO strings, lists keep their
 * `order`. Not in the snapshot on purpose: computed `rating`, the
 * affiliate URL (not page content), ids and timestamps.
 */

type Maybe<T> = T | null | undefined;
type DateLike = Date | string;

export interface PromotionContentLike {
  bankId: string;
  name: string;
  slug: string;
  accountType: string;
  maxBonusCents: number;
  difficulty: string;
  ratingOverride?: Maybe<number | string | { toString(): string }>;
  ratingReason?: Maybe<string>;
  status: string;
  startDate: DateLike;
  endDate: DateLike;
  sourceUrl?: Maybe<string>;
  additionalSourceUrls?: Maybe<string[]>;
  lastVerifiedAt: DateLike;
  eligibleFor?: Maybe<string>;
  notEligibleFor?: Maybe<string>;
  cooldownMonths?: Maybe<number>;
  cooldownCutoffDate?: Maybe<DateLike>;
  summary?: Maybe<string>;
  description?: Maybe<string>;
  conditions?: Maybe<{ title: string; description?: Maybe<string>; type: string; order?: Maybe<number> }[]>;
  bonusParts?: Maybe<{ label: string; amountCents: number; order?: Maybe<number>; availableUntil?: Maybe<DateLike> }[]>;
  fees?: Maybe<{
    accountFeeCents?: Maybe<number>;
    accountFeeWaiverCondition?: Maybe<string>;
    cardFeeCents?: Maybe<number>;
    cardFeeWaiverCondition?: Maybe<string>;
    atmFeeCents?: Maybe<number>;
    otherFee?: Maybe<string>;
    sourceUrl?: Maybe<string>;
  }>;
}

const text = (v: Maybe<string>): string | null => {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
};
const num = (v: Maybe<number>): number | null => (v == null || Number.isNaN(v) ? null : v);
const day = (v: Maybe<DateLike>): string | null => (v == null ? null : new Date(v).toISOString());
const dec = (v: Maybe<number | string | { toString(): string }>): number | null =>
  v == null || v === "" ? null : Number(v.toString());

function ordered<T extends { order?: Maybe<number> }>(list: Maybe<T[]>): T[] {
  return [...(list ?? [])]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.order ?? a.index) - (b.item.order ?? b.index) || a.index - b.index)
    .map((x) => x.item);
}

export function promotionContentSnapshot(p: PromotionContentLike): string {
  const fees = p.fees ?? {};
  return JSON.stringify({
    bankId: p.bankId,
    name: text(p.name),
    slug: p.slug,
    accountType: p.accountType,
    maxBonusCents: p.maxBonusCents,
    difficulty: p.difficulty,
    ratingOverride: dec(p.ratingOverride),
    ratingReason: text(p.ratingReason),
    status: p.status,
    startDate: day(p.startDate),
    endDate: day(p.endDate),
    sourceUrl: text(p.sourceUrl),
    additionalSourceUrls: p.additionalSourceUrls ?? [],
    lastVerifiedAt: day(p.lastVerifiedAt),
    eligibleFor: text(p.eligibleFor),
    notEligibleFor: text(p.notEligibleFor),
    cooldownMonths: num(p.cooldownMonths),
    cooldownCutoffDate: day(p.cooldownCutoffDate),
    summary: text(p.summary),
    description: text(p.description),
    conditions: ordered(p.conditions).map((c) => [text(c.title), text(c.description), c.type]),
    bonusParts: ordered(p.bonusParts).map((b) => [text(b.label), b.amountCents, day(b.availableUntil)]),
    fees: [
      num(fees.accountFeeCents),
      text(fees.accountFeeWaiverCondition),
      num(fees.cardFeeCents),
      text(fees.cardFeeWaiverCondition),
      num(fees.atmFeeCents),
      text(fees.otherFee),
      text(fees.sourceUrl)
    ]
  });
}

export function promotionContentChanged(before: PromotionContentLike, after: PromotionContentLike): boolean {
  return promotionContentSnapshot(before) !== promotionContentSnapshot(after);
}
