import { db } from "@/lib/db";
import { activeWhere } from "@/lib/services/promotions";
import { listPromotionCards } from "@/lib/services/promotionCards";
import {
  CONDITION_TYPE_CARD,
  CONDITION_TYPE_INFLOW,
  conditionFlagsFromTypes,
  toQuizOffers,
  type ConditionFlags,
  type QuizOffer
} from "@/lib/quiz";

/**
 * Which active offers have a card-payment or an inflow condition. The slim
 * card (PromotionCardData) carries only the FIRST condition's title, which is
 * not enough to tell whether an answer like "nie mogę płacić kartą" matters
 * for an offer, so the quiz reads just the condition `type` column here.
 * Public-safe: types and slugs only, nothing else leaves this function.
 */
async function loadConditionFlags(): Promise<Map<string, ConditionFlags>> {
  const rows = await db.promotionCondition.findMany({
    where: { type: { in: [CONDITION_TYPE_CARD, CONDITION_TYPE_INFLOW] }, promotion: activeWhere() },
    select: { type: true, promotion: { select: { slug: true } } }
  });

  const typesBySlug = new Map<string, string[]>();
  for (const row of rows) {
    const list = typesBySlug.get(row.promotion.slug) ?? [];
    list.push(row.type);
    typesBySlug.set(row.promotion.slug, list);
  }
  return new Map([...typesBySlug].map(([slug, types]) => [slug, conditionFlagsFromTypes(types)]));
}

/** Everything the quiz needs, built once on the server and passed to <QuizClient> as props. */
export async function loadQuizOffers(): Promise<QuizOffer[]> {
  const [cards, flags] = await Promise.all([listPromotionCards({ sort: "top-rated" }), loadConditionFlags()]);
  return toQuizOffers(cards, flags);
}
