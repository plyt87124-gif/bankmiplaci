import { db } from "@/lib/db";
import { Prisma, PromotionStatus, Difficulty } from "@prisma/client";
import { recomputeRatings } from "./ratings";

export type SortKey = "top-rated" | "highest-bonus" | "easiest" | "newest" | "ending-soon";

export interface PromotionFilters {
  q?: string;
  bankSlug?: string;
  accountType?: string;
  difficulty?: string[];
  minBonusCents?: number;
  maxAccountFeeCents?: number; // "bez opłat" style filter
  sort?: SortKey;
}

/**
 * Promotions are never deleted when they lapse — the spec requires that
 * an expired promotion becomes historical, not gone. Instead, any read
 * path that powers the *public* site excludes non-ACTIVE promotions and
 * anything whose end_date has already passed, even if a scheduled job
 * hasn't flipped its status yet (belt-and-braces against a missed cron).
 */
function activeWhere(): Prisma.PromotionWhereInput {
  return {
    status: PromotionStatus.ACTIVE,
    endDate: { gte: new Date() }
  };
}

function sortToOrderBy(sort?: SortKey): Prisma.PromotionOrderByWithRelationInput[] {
  switch (sort) {
    case "highest-bonus":
      return [{ maxBonusCents: "desc" }];
    case "easiest":
      return [{ difficulty: "asc" }, { rating: "desc" }];
    case "newest":
      return [{ startDate: "desc" }];
    case "ending-soon":
      return [{ endDate: "asc" }];
    case "top-rated":
    default:
      return [{ rating: "desc" }, { maxBonusCents: "desc" }];
  }
}

export async function listActivePromotions(filters: PromotionFilters = {}) {
  const where: Prisma.PromotionWhereInput = {
    ...activeWhere(),
    ...(filters.bankSlug ? { bank: { slug: filters.bankSlug } } : {}),
    ...(filters.accountType ? { accountType: filters.accountType as never } : {}),
    ...(filters.difficulty?.length ? { difficulty: { in: filters.difficulty as never[] } } : {}),
    ...(filters.minBonusCents ? { maxBonusCents: { gte: filters.minBonusCents } } : {}),
    ...(filters.maxAccountFeeCents !== undefined
      ? { fees: { accountFeeCents: { lte: filters.maxAccountFeeCents } } }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { summary: { contains: filters.q, mode: "insensitive" } },
            { bank: { name: { contains: filters.q, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  return db.promotion.findMany({
    where,
    include: { bank: true, fees: true },
    orderBy: sortToOrderBy(filters.sort)
  });
}

export async function getPromotionBySlug(slug: string) {
  const promotion = await db.promotion.findUnique({
    where: { slug },
    include: {
      bank: true,
      fees: true,
      conditions: { orderBy: { order: "asc" } },
      bonusParts: { orderBy: { order: "asc" } }
    }
  });

  if (!promotion) return null;

  // A DRAFT promotion is only reachable through the admin preview link,
  // never indexable/listed publicly. Callers on the public site should
  // treat this the same as "not found" unless previewing.
  return promotion;
}

export async function countActivePromotions(): Promise<number> {
  return db.promotion.count({ where: activeWhere() });
}

export interface EffortShowcaseItem {
  slug: string;
  name: string;
  bankName: string;
  maxBonusCents: number;
  difficulty: Difficulty;
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { VERY_EASY: 0, EASY: 1, MEDIUM: 2, HARD: 3 };

/**
 * Two real, currently-active PERSONAL-account promotions used on the
 * homepage "Ile wysiłku wymaga promocja?" section — the easiest-difficulty
 * example available and the hardest-difficulty example available, picking
 * the highest bonus within each tier. Restricted to personal accounts so
 * the comparison stays apples-to-apples (business promotions tend to run
 * larger and harder, which would skew the illustration). Never fabricated:
 * if the active set only spans one difficulty tier (or is empty), returns
 * fewer items rather than inventing a second one.
 */
export async function getEffortShowcase(): Promise<EffortShowcaseItem[]> {
  const promos = await db.promotion.findMany({
    where: { ...activeWhere(), accountType: "PERSONAL" },
    select: { slug: true, name: true, maxBonusCents: true, difficulty: true, bank: { select: { name: true } } }
  });
  if (promos.length === 0) return [];

  const items: EffortShowcaseItem[] = promos.map((p) => ({
    slug: p.slug,
    name: p.name,
    bankName: p.bank.name,
    maxBonusCents: p.maxBonusCents,
    difficulty: p.difficulty
  }));

  const byEasiest = [...items].sort(
    (a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || b.maxBonusCents - a.maxBonusCents
  );
  const byHardest = [...items].sort(
    (a, b) => DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[a.difficulty] || b.maxBonusCents - a.maxBonusCents
  );
  const easiest = byEasiest[0] as EffortShowcaseItem;
  const hardest = byHardest[0] as EffortShowcaseItem;

  return easiest.slug === hardest.slug ? [easiest] : [easiest, hardest];
}

/**
 * Flips any ACTIVE promotion whose end_date has passed to EXPIRED.
 * Intended to run on a schedule (see scripts/expire-promotions.ts and
 * /api/cron/expire-promotions), but listActivePromotions() above is
 * itself immune to a missed run because it filters on end_date directly.
 */
export async function expirePastPromotions(): Promise<number> {
  const result = await db.promotion.updateMany({
    where: { status: PromotionStatus.ACTIVE, endDate: { lt: new Date() } },
    data: { status: PromotionStatus.EXPIRED }
  });
  // Promotions leaving the active set shift everyone else's relative score.
  if (result.count > 0) await recomputeRatings();
  return result.count;
}
