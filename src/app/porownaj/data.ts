import { db } from "@/lib/db";

/**
 * What the comparison needs beyond the slim card (PromotionCardData): the
 * structured karencja and whether OUR partner link is live. Public data only
 * (it is shown on the offer page); no affiliate URL and no commission.
 */
export interface CompareExtras {
  cooldownMonths: number | null;
  cooldownCutoffDate: Date | null;
  /** false = the CTA must not be shown (/out would only bounce the visitor). */
  affiliateLinkEnabled: boolean;
}

export async function loadCompareExtras(slugs: readonly string[]): Promise<Map<string, CompareExtras>> {
  if (slugs.length === 0) return new Map();
  const rows = await db.promotion.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true, cooldownMonths: true, cooldownCutoffDate: true, affiliateLinkEnabled: true }
  });
  return new Map(
    rows.map((row) => [
      row.slug,
      {
        cooldownMonths: row.cooldownMonths,
        cooldownCutoffDate: row.cooldownCutoffDate,
        affiliateLinkEnabled: row.affiliateLinkEnabled
      }
    ])
  );
}
