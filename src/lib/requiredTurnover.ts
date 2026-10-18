/**
 * Rough estimate of the money a customer has to move or spend to earn a
 * promotion ("wymagany obrót"), read from the free-text conditions.
 *
 * It is an estimate used only to compare offers of the same account type: the
 * amounts are the thresholds named in the conditions ("wpływ min. 1000 zł",
 * "wydatki kartą min. 2000 zł"), multiplied by the number of months they must
 * be repeated. Loans, leasing, rentals, limits and insurance are ignored here
 * (buying a product is not turnover). When no threshold can be read the result
 * is null and the rating treats the component as unknown (neutral) instead of
 * guessing.
 */

export interface TurnoverCondition {
  title: string;
  description: string | null;
}

const PRODUCT_WORDS = /kredyt|leasing|najem|najm[ue]|limit w|ubezpiecz|terminal|ksiegowo|księgowo/i;
const AMOUNT = /(min\.?|minimum|co najmniej|wpływ(?:y|em)?|wydatk\w*(?: kart\w*)?|obrot\w*)\s*(?:na |w wysokości |łącznie )?(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,]\d+)?\s*(?:zł|pln)/gi;
const MONTHLY = /każd\w+\s+(?:z\s+\d+\s+)?(?:kolejn\w+\s+)?(?:pełn\w+\s+)?miesi|miesięczn|w miesiącu|\/\s*mies|co miesiąc/i;
const REPEATS = /(\d{1,2})\s+(?:kolejn|pełn|miesi)/i;

function conditionCost(text: string, durationMonths: number): number {
  if (PRODUCT_WORDS.test(text)) return 0;
  let best = 0;
  for (const m of text.matchAll(AMOUNT)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0);
    if (/max\.?\s*$|do\s*$/i.test(before)) continue;
    const value = Number(m[2]!.replace(/[  ]/g, ""));
    if (Number.isFinite(value) && value > best) best = value;
  }
  if (best === 0) return 0;
  if (!MONTHLY.test(text)) return best;
  const repeats = Number(REPEATS.exec(text)?.[1] ?? durationMonths);
  return best * Math.max(1, Math.min(repeats, Math.max(1, durationMonths)));
}

/** Estimated required turnover in grosze, or null when the conditions name no threshold. */
export function estimateRequiredTurnoverCents(
  conditions: readonly TurnoverCondition[],
  durationMonths: number | null
): number | null {
  const months = durationMonths ?? 1;
  let totalZl = 0;
  for (const c of conditions) totalZl += conditionCost(`${c.title} ${c.description ?? ""}`, months);
  return totalZl > 0 ? Math.round(totalZl * 100) : null;
}
