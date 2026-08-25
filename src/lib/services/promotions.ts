import { db } from "@/lib/db";
import { Prisma, PromotionStatus } from "@prisma/client";

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
  return result.count;
}
