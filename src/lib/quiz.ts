/**
 * Logic of the quiz "Dobierz promocję do siebie" - PURE (no React, no database,
 * no `Date.now()`), so every rule is covered by tests/quiz.test.ts.
 *
 * What the answers do (all five really change the result):
 *   effort      +2 points when the offer's difficulty fits the chosen effort;
 *               an offer harder than the chosen ceiling gets a caution.
 *   audience    only personal accounts OR only business accounts are ranked.
 *   canCardPay  "no" pushes every offer whose conditions include card payments
 *               (condition type "card_payments") below every offer that does not.
 *   canInflow   same for conditions of type "inflow" (a regular transfer in).
 *   topBonus    "yes" adds 1 point per 200 zl of the maximum bonus (BONUS_DIVISOR_CENTS),
 *               which makes the bonus decide the order - that is the point of the answer.
 *
 * The ranking is a SORT of the offers we have analysed - never advice. The
 * partner commission is not an input anywhere (it is not even in the data the
 * quiz receives), and the order is by the answers, not by "Polecane".
 *
 * Honesty about the data: "needs card payments / an inflow" comes from the
 * `type` column of the offer's conditions as entered in the admin. A flagged
 * offer may need the card only for ONE of several rewards, so the quiz words
 * it as "obejmuje warunek ...", never as "nie dostaniesz premii".
 */
import type { AccountType, Difficulty } from "@prisma/client";
import { DIFFICULTY_LABEL, formatPLN, formatRatingOutOf10 } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Constants shown in copy ("5 pytań", "3 promocje")                    */
/* ------------------------------------------------------------------ */

export type EffortPref = "low" | "medium" | "high";
export type AudiencePref = "personal" | "business";

export interface QuizAnswers {
  effort: EffortPref;
  audience: AudiencePref;
  canCardPay: boolean;
  canInflow: boolean;
  topBonus: boolean;
}

export type QuizQuestionId = keyof QuizAnswers;

export interface QuizOption {
  /** Stable id stored in the wizard state ("low", "yes", ...). */
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: QuizQuestionId;
  title: string;
  /** One quiet line under the title. */
  hint?: string;
  options: readonly QuizOption[];
}

const YES_NO: readonly QuizOption[] = [
  { id: "yes", label: "Tak" },
  { id: "no", label: "Nie" }
];

/** The questions in the order they are asked. The count in copy comes from here. */
export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: "effort",
    title: "Ile pracy chcesz włożyć w promocję?",
    hint: "Trudność oferty oceniamy po liczbie i uciążliwości warunków.",
    options: [
      { id: "low", label: "Jak najmniej" },
      { id: "medium", label: "Mogę zrobić trochę więcej" },
      { id: "high", label: "Nie ma znaczenia, zależy mi na wysokiej premii" }
    ]
  },
  {
    id: "audience",
    title: "Dla kogo ma być konto?",
    options: [
      { id: "personal", label: "Dla mnie, jako osoby prywatnej" },
      { id: "business", label: "Dla mojej działalności gospodarczej" }
    ]
  },
  {
    id: "canCardPay",
    title: "Czy możesz regularnie płacić kartą lub BLIK-iem?",
    hint: "Część promocji wymaga kilku płatności w miesiącu.",
    options: YES_NO
  },
  {
    id: "canInflow",
    title: "Czy możesz zapewnić regularny wpływ na konto?",
    hint: "Na przykład wynagrodzenie albo przelew z innego banku. Część promocji tego wymaga.",
    options: YES_NO
  },
  {
    id: "topBonus",
    title: "Czy zależy Ci głównie na jak najwyższej premii?",
    options: YES_NO
  }
];

export const QUIZ_QUESTION_COUNT = QUIZ_QUESTIONS.length;
/** How many offers the result shows. */
export const QUIZ_RESULT_COUNT = 3;

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

/** Option ids chosen so far, by question id (the wizard's state). */
export type QuizDraft = Partial<Record<QuizQuestionId, string>>;

/**
 * Turns the wizard state into typed answers; `null` while any question is
 * unanswered or holds an id that is not one of its options.
 */
export function parseAnswers(draft: QuizDraft): QuizAnswers | null {
  const valid = (id: QuizQuestionId): string | null => {
    const value = draft[id];
    const question = QUIZ_QUESTIONS.find((q) => q.id === id);
    return value !== undefined && question?.options.some((o) => o.id === value) ? value : null;
  };
  const effort = valid("effort");
  const audience = valid("audience");
  const canCardPay = valid("canCardPay");
  const canInflow = valid("canInflow");
  const topBonus = valid("topBonus");
  if (!effort || !audience || !canCardPay || !canInflow || !topBonus) return null;
  return {
    effort: effort as EffortPref,
    audience: audience as AudiencePref,
    canCardPay: canCardPay === "yes",
    canInflow: canInflow === "yes",
    topBonus: topBonus === "yes"
  };
}

/* ------------------------------------------------------------------ */
/* Offers                                                              */
/* ------------------------------------------------------------------ */

/** What the quiz needs about one offer. Public data only; serialisable (client props). */
export interface QuizOffer {
  slug: string;
  name: string;
  bank: { name: string; slug: string; logoUrl: string | null };
  accountType: AccountType;
  difficulty: Difficulty;
  maxBonusCents: number;
  /** "Ocena serwisu" 0..10 (never influenced by the commission). */
  rating: number;
  /** ISO string (a Date does not survive the server -> client boundary as a Date). */
  endDate: string;
  /** Some condition of the offer has type "card_payments". */
  needsCardPayments: boolean;
  /** Some condition of the offer has type "inflow". */
  needsInflow: boolean;
}

/** Condition `type` values (PromotionCondition.type) the quiz reads. */
export const CONDITION_TYPE_CARD = "card_payments";
export const CONDITION_TYPE_INFLOW = "inflow";

export interface ConditionFlags {
  needsCardPayments: boolean;
  needsInflow: boolean;
}

/** Flags of one offer from the `type` values of its conditions. */
export function conditionFlagsFromTypes(types: Iterable<string>): ConditionFlags {
  let needsCardPayments = false;
  let needsInflow = false;
  for (const type of types) {
    if (type === CONDITION_TYPE_CARD) needsCardPayments = true;
    if (type === CONDITION_TYPE_INFLOW) needsInflow = true;
  }
  return { needsCardPayments, needsInflow };
}

/** The card fields the quiz copies (structural, so the module needs no server import). */
export interface QuizSourceCard {
  slug: string;
  name: string;
  bank: { name: string; slug: string; logoUrl: string | null };
  accountType: AccountType;
  difficulty: Difficulty;
  maxBonusCents: number;
  rating: number;
  endDate: Date | string;
}

/**
 * Builds the client payload field by field (nothing else from the card can
 * slip through). An offer with no entry in `flags` has no card/inflow condition.
 */
export function toQuizOffers(
  cards: readonly QuizSourceCard[],
  flags: ReadonlyMap<string, ConditionFlags>
): QuizOffer[] {
  return cards.map((card) => {
    const flag = flags.get(card.slug);
    return {
      slug: card.slug,
      name: card.name,
      bank: { name: card.bank.name, slug: card.bank.slug, logoUrl: card.bank.logoUrl },
      accountType: card.accountType,
      difficulty: card.difficulty,
      maxBonusCents: card.maxBonusCents,
      rating: Number(card.rating),
      endDate: card.endDate instanceof Date ? card.endDate.toISOString() : String(card.endDate),
      needsCardPayments: flag?.needsCardPayments ?? false,
      needsInflow: flag?.needsInflow ?? false
    };
  });
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** Difficulties that fit each effort answer (original quiz mapping, kept). */
export const EFFORT_TO_DIFFICULTY: Record<EffortPref, readonly Difficulty[]> = {
  low: ["VERY_EASY", "EASY"],
  medium: ["EASY", "MEDIUM"],
  high: ["MEDIUM", "HARD"]
};

/** Offers harder than this are flagged with a caution (the effort answer's ceiling). */
const TOO_HARD_FOR: Record<EffortPref, readonly Difficulty[]> = {
  low: ["MEDIUM", "HARD"],
  medium: ["HARD"],
  high: []
};

export const EFFORT_FIT_POINTS = 2;
/** "Mostly the bonus": +1 point per 200 zl of the maximum bonus (original weighting, kept). */
export const BONUS_DIVISOR_CENTS = 20_000;

export interface QuizMatch {
  offer: QuizOffer;
  /** Rating + effort fit + bonus points. Comparable only within one result. */
  score: number;
  /** Number of conditions the user said they cannot meet (0..2). Ranks before the score. */
  unmet: number;
  /** Why it fits, as short facts. */
  reasons: string[];
  /** What to watch out for. */
  cautions: string[];
}

function isBusiness(offer: QuizOffer): boolean {
  return offer.accountType === "BUSINESS";
}

function lower(label: string): string {
  return label.toLocaleLowerCase("pl-PL");
}

function scoreOffer(offer: QuizOffer, answers: QuizAnswers): QuizMatch {
  const rating = Number.isFinite(offer.rating) ? offer.rating : 0;
  const effortFit = EFFORT_TO_DIFFICULTY[answers.effort].includes(offer.difficulty);

  let score = rating;
  if (effortFit) score += EFFORT_FIT_POINTS;
  if (answers.topBonus) score += Math.max(0, offer.maxBonusCents) / BONUS_DIVISOR_CENTS;

  const reasons: string[] = [];
  const cautions: string[] = [];
  const difficulty = lower(DIFFICULTY_LABEL[offer.difficulty]);

  if (effortFit) reasons.push(`trudność „${difficulty}” pasuje do Twojego nakładu pracy`);
  else if (TOO_HARD_FOR[answers.effort].includes(offer.difficulty)) {
    cautions.push(`Wymaga więcej pracy, niż zakładasz (trudność: ${difficulty}).`);
  }

  if (answers.topBonus && offer.maxBonusCents > 0) reasons.push(`premia do ${formatPLN(offer.maxBonusCents)}`);
  reasons.push(`ocena serwisu ${formatRatingOutOf10(rating)}`);

  let unmet = 0;
  if (offer.needsCardPayments) {
    if (answers.canCardPay) reasons.push("warunki obejmują płatności kartą, które możesz spełnić");
    else {
      unmet += 1;
      cautions.push("Obejmuje warunek płatności kartą, a zaznaczono, że nie możesz go spełnić. Część nagrody może być poza zasięgiem.");
    }
  }
  if (offer.needsInflow) {
    if (answers.canInflow) reasons.push("warunki obejmują wpływ na konto, który możesz zapewnić");
    else {
      unmet += 1;
      cautions.push("Obejmuje warunek wpływu na konto, a zaznaczono, że nie możesz go zapewnić. Część nagrody może być poza zasięgiem.");
    }
  }

  return { offer, score, unmet, reasons, cautions };
}

/**
 * The best `limit` offers for the answers: offers of the chosen kind of account,
 * those without a condition the user cannot meet first, then by score, then by
 * rating, then by slug (so the order never flickers between renders).
 */
export function matchOffers(
  offers: readonly QuizOffer[],
  answers: QuizAnswers,
  limit: number = QUIZ_RESULT_COUNT
): QuizMatch[] {
  const wantBusiness = answers.audience === "business";
  return offers
    .filter((offer) => isBusiness(offer) === wantBusiness)
    .map((offer) => scoreOffer(offer, answers))
    .sort(
      (a, b) =>
        a.unmet - b.unmet ||
        b.score - a.score ||
        b.offer.rating - a.offer.rating ||
        a.offer.slug.localeCompare(b.offer.slug)
    )
    .slice(0, Math.max(0, limit));
}

/** "Dlaczego: trudność „łatwa” pasuje ...; ocena serwisu 8,9/10." - one sentence for the result card. */
export function explainMatch(match: Pick<QuizMatch, "reasons">): string {
  if (match.reasons.length === 0) return "";
  const text = match.reasons.join("; ");
  return `Dlaczego: ${text}.`;
}

/* ------------------------------------------------------------------ */
/* Link to the comparison                                              */
/* ------------------------------------------------------------------ */

/**
 * "Porównaj te 3": /porownaj with the matches pre-selected. Param names match
 * the page (`oferty` = comma separated slugs, `typ` = BUSINESS for business
 * accounts; personal is the page's default and is left out).
 */
export function buildCompareHref(slugs: readonly string[], audience: AudiencePref): string {
  const params: string[] = [];
  if (audience === "business") params.push("typ=BUSINESS");
  if (slugs.length > 0) params.push(`oferty=${slugs.map(encodeURIComponent).join(",")}`);
  return params.length > 0 ? `/porownaj?${params.join("&")}` : "/porownaj";
}
