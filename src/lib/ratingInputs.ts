/**
 * Turns what the database holds about a promotion (bonus parts, checklist
 * steps, fees, karencja, the commission we are paid) into the numbers of the
 * rating (ratingModel.ts). Pure: no database, the caller passes plain rows.
 *
 * The own turnover is READ from the texts of the checklist steps and the bonus
 * parts, so it is an estimate; where a text cannot be read the offer is listed
 * in TURNOVER_OVERRIDES_ZL by hand (verified against the bank's terms), and an
 * administrator can always set `ratingOverride` on a single offer.
 */
import type { CashbackPart, DifficultyKey, RatingInput } from "@/lib/ratingModel";
import { CONDITIONAL_FEE_SHARE } from "@/lib/ratingModel";

export interface RatingSource {
  id: string;
  slug: string;
  accountType: string;
  maxBonusCents: number;
  difficulty: DifficultyKey;
  cooldownMonths: number | null;
  cooldownCutoffDate: Date | null;
  bonusParts: readonly { label: string; amountCents: number }[];
  checklistSteps: readonly { order: number; title: string; rewardCents: number | null }[];
  fees: {
    accountFeeCents: number | null;
    accountFeeWaiverCondition: string | null;
    cardFeeCents: number | null;
    cardFeeWaiverCondition: string | null;
  } | null;
  /** Commission + contest per client, grosze (effectiveCommission.ts); null = no campaign linked. */
  commissionCents: number | null;
}

/**
 * Minimum own turnover (zł) for the FIXED parts of an offer whose conditions cannot be read from the
 * text. Each entry is an assumption read by hand from the offer; keep the reason next to it.
 */
export const TURNOVER_OVERRIDES_ZL: Record<string, number> = {
  // 200 000 EUR exchanged (about 850 000 zł) and an average balance above 200 000 EUR for the top tier.
  "nest-zyskaj-do-3000-zl-wymiana-saldo-eur": 935_000
};

/** Parts of a premium that do not count: products bought, not turnover (terminal, credit, loan, leasing, factoring, insurance). */
const EXCLUDED_PART = /terminal|kredyt|pożyczk|pozyczk|leasing|faktoring|ubezpiecz/i;
/** Steps that only collect or optionally add something. */
const NOT_A_THRESHOLD = /opcjonalnie|odbierz/i;
const TAXES = /\bzus\b|\bus\b|podatk/i;
const AMOUNT = /(\d{1,3}(?:[\s  ]\d{3})+|\d+)(?:[.,]\d+)?\s*(?:zł|pln)/gi;
const SPACES = /[\s  ]/g;

const toNumber = (s: string) => Number(s.replace(SPACES, "").replace(",", "."));

/** The minimum spending and the minimum inflow that ONE checklist step asks for (0 = no amount, e.g. "3 płatności"). */
export function stepTurnover(title: string): { spend: number; inflow: number } {
  const t = title.toLowerCase();
  const zero = { spend: 0, inflow: 0 };
  if (NOT_A_THRESHOLD.test(t) || EXCLUDED_PART.test(t) || TAXES.test(t)) return zero;

  const found: { value: number; inflow: boolean }[] = [];
  for (const m of t.matchAll(AMOUNT)) {
    const before = t.slice(Math.max(0, (m.index ?? 0) - 45), m.index ?? 0);
    if (/(^|\s)do\s+$/.test(before)) continue; // "do 100 zł" is a cap, not a threshold
    const value = toNumber(m[1]!);
    const inflow =
      /wpływ|wynagrodz|zasil|wpłać|wpłat|saldo/.test(before) ||
      (!/kart|płatn|zapłać|transakc|zakup|wydaj|wydatk|blik/.test(before) && /wpływ|wynagrodz|zasil/.test(t));
    found.push({ value, inflow });
  }
  if (found.length === 0) return zero;

  // "1500 zł do 26 lat, 3000 zł od 26 lat": the offer is taken with the lowest tier.
  const ageTiers = /\blat\b/.test(t);
  const pick = (values: number[]) => (values.length === 0 ? 0 : ageTiers ? Math.min(...values) : Math.max(...values));
  return {
    spend: pick(found.filter((f) => !f.inflow).map((f) => f.value)),
    inflow: pick(found.filter((f) => f.inflow).map((f) => f.value))
  };
}

/** Rates (0.2 = 20%) named in the monthly steps, in order: "zwrot 3%", "10 zł za każde 50 zł". */
function stepRates(steps: RatingSource["checklistSteps"]): number[] {
  const rates: number[] = [];
  for (const s of steps) {
    if (s.rewardCents !== null || s.order < 10 || /opcjonalnie/i.test(s.title)) continue;
    for (const m of s.title.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)) rates.push(toNumber(m[1]!) / 100);
    const per = /(\d+)\s*zł\s*za\s*każde\s*(\d+)\s*zł/i.exec(s.title);
    if (per) rates.push(Number(per[1]) / Number(per[2]));
  }
  return rates;
}

function monthsSince(date: Date, now: Date): number {
  return Math.max(0, (now.getTime() - date.getTime()) / (30.44 * 86_400_000));
}

/** Months the checklist spans (>= 1), null without a checklist. Same rule as everywhere else on the site. */
export function durationMonthsOf(steps: RatingSource["checklistSteps"]): number | null {
  if (steps.length === 0) return null;
  return Math.max(1, ...steps.map((s) => Math.floor(s.order / 10)));
}

export function buildRatingInput(src: RatingSource, now: Date): RatingInput {
  const durationMonths = durationMonthsOf(src.checklistSteps);

  // ---- premium parts that count ----
  const parts = src.bonusParts.length > 0
    ? src.bonusParts.map((p) => ({ label: p.label, zl: p.amountCents / 100 }))
    : [{ label: "Premia", zl: src.maxBonusCents / 100 }];
  const counted = parts.filter((p) => !EXCLUDED_PART.test(p.label));

  // ---- which counted parts are paid as a share of spending ----
  const monthlyRates = stepRates(src.checklistSteps);
  let nextRate = 0;
  const cashbackParts: CashbackPart[] = [];
  let fixedPremiumZl = 0;
  for (const p of counted) {
    const inLabel = /(\d+(?:[.,]\d+)?)\s*%/.exec(p.label);
    let rate: number | null = inLabel ? toNumber(inLabel[1]!) / 100 : null;
    if (rate === null && /zwrot|cashback/i.test(p.label) && monthlyRates.length > 0) {
      rate = monthlyRates[Math.min(nextRate++, monthlyRates.length - 1)]!;
    }
    if (rate !== null && rate > 0) cashbackParts.push({ premiumZl: p.zl, rate });
    else fixedPremiumZl += p.zl;
  }

  // ---- own turnover of the fixed parts: thresholds of the monthly steps, month by month ----
  const byMonth = new Map<number, { spend: number; inflow: number }>();
  for (const s of src.checklistSteps) {
    if (s.rewardCents !== null) continue;
    const month = Math.floor(s.order / 10);
    const t = stepTurnover(s.title);
    const prev = byMonth.get(month) ?? { spend: 0, inflow: 0 };
    byMonth.set(month, { spend: Math.max(prev.spend, t.spend), inflow: Math.max(prev.inflow, t.inflow) });
  }
  const spendTotal = [...byMonth.values()].reduce((s, m) => s + m.spend, 0);
  const inflowTotal = [...byMonth.values()].reduce((s, m) => s + m.inflow, 0);
  // Money that only has to ARRIVE on the account (salary, transfers) counts a tenth: it is not spent.
  // When part of the premium is cashback, the card spending thresholds belong to that part.
  const fixedTurnoverZl =
    TURNOVER_OVERRIDES_ZL[src.slug] ?? (cashbackParts.length > 0 ? 0.1 * inflowTotal : spendTotal + 0.1 * inflowTotal);

  // ---- fees over the promotion ----
  const months = Math.min(12, Math.max(1, durationMonths ?? 1));
  const f = src.fees;
  const accountFee = f?.accountFeeCents ?? 0;
  const cardFee = f?.cardFeeCents ?? 0;
  const unconditionalCents = (f?.accountFeeWaiverCondition ? 0 : accountFee) + (f?.cardFeeWaiverCondition ? 0 : cardFee);
  const conditionalCents = (f?.accountFeeWaiverCondition ? accountFee : 0) + (f?.cardFeeWaiverCondition ? cardFee : 0);
  const feesKnown = f !== null && (f.accountFeeCents !== null || f.cardFeeCents !== null);

  // ---- karencja: the stated months, or how far back the bank looks ----
  const cooldown = Math.max(src.cooldownMonths ?? 0, src.cooldownCutoffDate ? monthsSince(src.cooldownCutoffDate, now) : 0);

  return {
    id: src.id,
    accountType: src.accountType,
    difficulty: src.difficulty,
    fixedPremiumZl,
    fixedTurnoverZl,
    cashbackParts,
    unconditionalFeesZl: (unconditionalCents / 100) * months,
    feeBurdenZl: feesKnown ? (unconditionalCents / 100) * months + CONDITIONAL_FEE_SHARE * (conditionalCents / 100) * months : null,
    cooldownMonths: cooldown > 0 ? cooldown : null,
    durationMonths,
    commissionZl: src.commissionCents === null ? null : src.commissionCents / 100
  };
}
