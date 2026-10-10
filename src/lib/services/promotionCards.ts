import { db } from "@/lib/db";
import type { AccountType, Difficulty, Prisma } from "@prisma/client";
import { hasFeeCaveat } from "@/lib/feeModel";
import { sortRecommended } from "@/lib/recommended";
import { signupCutoff } from "@/lib/promotionAvailability";
import { activeWhere, buildActiveWhere, sortToOrderBy, type PromotionFilters } from "@/lib/services/promotions";

/**
 * Slim, PUBLIC-SAFE promotion shape for every list-like surface (cards on the
 * home page, listing, bank and SEO hubs, quiz, comparison). It is the contract
 * the UI packages build against.
 *
 * What is deliberately NOT in here: `affiliateUrl` (outbound links go through
 * /out/[slug]) and `affiliateCommissionCents` (business-internal, only used to
 * order "Polecane" inside this module and removed before anything is returned)
 * and the TEXT of `Fees.otherFee` (only its yes/no, `fees.hasOtherFee`, is carried).
 * Adding a field here means it becomes public: it ends up in server-rendered
 * HTML, client component props and /api/promotions/active.
 *
 * Dates are `Date` on the server. Over JSON (the API, SWR in the quiz) they
 * arrive as ISO strings: use `PromotionCardJson` on the client.
 */
export interface PromotionCardData {
  slug: string;
  name: string;
  summary: string | null;
  maxBonusCents: number;
  difficulty: Difficulty;
  accountType: AccountType;
  /** "Ocena serwisu" 0..10. Never influenced by the partner commission. */
  rating: number;
  ratingReason: string | null;
  endDate: Date;
  lastVerifiedAt: Date;
  /** null = no Fees row yet ("nieustalone"), never "free". */
  fees: {
    accountFeeCents: number | null;
    accountFeeWaiverCondition: string | null;
    cardFeeCents: number | null;
    cardFeeWaiverCondition: string | null;
    /**
     * Yes/no only: the offer has an "Inne opłaty" remark (Fees.otherFee), so a
     * bare 0 zł is the best case and reads "od 0 zł" (src/lib/feeModel.ts).
     * The remark's TEXT never reaches a card - it is shown on the offer page.
     * Always set by `toCard`; optional in the type only so that hand-written
     * fixtures without it keep compiling (missing = no remark).
     */
    hasOtherFee?: boolean;
  } | null;
  /** At most one entry: the first condition by `order` (empty when there are none). */
  conditions: { title: string }[];
  bank: { name: string; slug: string; logoUrl: string | null };
}

/** The same card after a JSON round trip (dates become ISO strings). */
export type PromotionCardJson = Omit<PromotionCardData, "endDate" | "lastVerifiedAt"> & {
  endDate: string;
  lastVerifiedAt: string;
};

/**
 * Explicit column list. Anything not named here cannot reach a card, even if a
 * column is added to the model later. `affiliateCommissionCents` is selected
 * only so the "Polecane" order can be computed; see `finalizeCards`.
 */
export const PROMOTION_CARD_SELECT = {
  slug: true,
  name: true,
  summary: true,
  maxBonusCents: true,
  difficulty: true,
  accountType: true,
  rating: true,
  ratingReason: true,
  endDate: true,
  lastVerifiedAt: true,
  affiliateCommissionCents: true,
  fees: {
    select: {
      accountFeeCents: true,
      accountFeeWaiverCondition: true,
      cardFeeCents: true,
      cardFeeWaiverCondition: true,
      // Read only to derive the boolean `hasOtherFee` in `toCard`; the text is not copied.
      otherFee: true
    }
  },
  conditions: { select: { title: true }, orderBy: { order: "asc" }, take: 1 },
  bank: { select: { name: true, slug: true, logoUrl: true } }
} satisfies Prisma.PromotionSelect;

export type CardRow = Prisma.PromotionGetPayload<{ select: typeof PROMOTION_CARD_SELECT }>;

function toCard(row: CardRow): PromotionCardData {
  return {
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    maxBonusCents: row.maxBonusCents,
    difficulty: row.difficulty,
    accountType: row.accountType,
    rating: Number(row.rating),
    ratingReason: row.ratingReason,
    endDate: row.endDate,
    lastVerifiedAt: row.lastVerifiedAt,
    fees: row.fees
      ? {
          accountFeeCents: row.fees.accountFeeCents,
          accountFeeWaiverCondition: row.fees.accountFeeWaiverCondition,
          cardFeeCents: row.fees.cardFeeCents,
          cardFeeWaiverCondition: row.fees.cardFeeWaiverCondition,
          hasOtherFee: hasFeeCaveat(row.fees.otherFee)
        }
      : null,
    conditions: row.conditions.map((c) => ({ title: c.title })),
    bank: { name: row.bank.name, slug: row.bank.slug, logoUrl: row.bank.logoUrl }
  };
}

/**
 * Orders the rows ("Polecane" blends rating with the partner commission; every
 * other sort was already applied by the query) and returns public cards. The
 * commission is read here and nowhere after: the returned objects are built
 * field by field in `toCard`, so it cannot be carried along. Pure, so the
 * privacy and ordering invariants are unit-tested without a database.
 */
export function finalizeCards(rows: CardRow[], sort?: PromotionFilters["sort"]): PromotionCardData[] {
  const ordered =
    sort === "recommended" || sort === undefined
      ? sortRecommended(
          rows.map((row) => ({
            row,
            accountType: row.accountType as string,
            rating: Number(row.rating),
            maxBonusCents: row.maxBonusCents,
            commissionCents: row.affiliateCommissionCents
          }))
        ).map((x) => x.row)
      : rows;
  return ordered.map(toCard);
}

/** Same filters and sorts as listActivePromotions (SortKey), slim public output. */
export async function listPromotionCards(filters: PromotionFilters = {}): Promise<PromotionCardData[]> {
  const rows = await db.promotion.findMany({
    where: buildActiveWhere(filters),
    select: PROMOTION_CARD_SELECT,
    orderBy: sortToOrderBy(filters.sort)
  });
  return finalizeCards(rows, filters.sort);
}

/** Active offers of one bank, in the default "Polecane" order. */
export function getBankCards(bankSlug: string): Promise<PromotionCardData[]> {
  return listPromotionCards({ bankSlug, sort: "recommended" });
}

/**
 * Open offers whose last sign-up day falls within the next `days` days
 * (Polish calendar, today included), soonest deadline first.
 */
export async function getEndingSoon(days: number, now: Date = new Date()): Promise<PromotionCardData[]> {
  const from = signupCutoff(now);
  const until = new Date(from.getTime() + Math.max(0, Math.floor(days)) * 24 * 60 * 60 * 1000);
  const rows = await db.promotion.findMany({
    where: { ...activeWhere(), endDate: { gte: from, lte: until } },
    select: PROMOTION_CARD_SELECT,
    orderBy: [{ endDate: "asc" }, { rating: "desc" }]
  });
  return finalizeCards(rows, "ending-soon");
}

/** Number of offers on the public list, optionally narrowed by the same filters. */
export function countActive(filters: PromotionFilters = {}): Promise<number> {
  return db.promotion.count({ where: buildActiveWhere(filters) });
}
