/**
 * Pure rules that tell the broker's COMMISSION terms apart from the bank's
 * PREMIUM (bonus) terms, and match a broker campaign to a promotion on the site.
 *
 *  - The bank's promotion has its own "karencja" (cooldownMonths /
 *    cooldownCutoffDate): it decides whether the client gets the bonus.
 *  - The broker pays the commission only for a NEW client, as the panel words
 *    it ("nie posiadał rachunku w ciągu ostatnich dwóch lat", "od 01.01.2023").
 *    That window is usually different, so the two dates are never mixed.
 *
 * No database access here (tests/affiliate-rules.test.ts).
 */

export type NewClientRule =
  | { kind: "months"; months: number }
  | { kind: "since"; date: Date }
  | { kind: "never" };

const MONTHS_PL: Record<string, number> = {
  stycznia: 1,
  lutego: 2,
  marca: 3,
  kwietnia: 4,
  maja: 5,
  czerwca: 6,
  lipca: 7,
  sierpnia: 8,
  wrze: 9,
  pa: 10,
  listopada: 11,
  grudnia: 12
};

function monthFromWord(word: string): number | null {
  const w = word.toLowerCase();
  if (MONTHS_PL[w]) return MONTHS_PL[w];
  if (w.startsWith("wrze")) return 9;
  if (w.startsWith("pa") && w.includes("dziernik")) return 10;
  return null;
}

const NUMBER_WORDS: Record<string, number> = { jednego: 1, dwóch: 2, dwoch: 2, trzech: 3, pięciu: 5 };

/** Near a client-history word: the date / months only count as a new-client window there. */
const CLIENT_CONTEXT = /(nowy|nowego|nowych|posiada|posiadał|posiadala|posiadali|relacj|rachunk|konta|klient)/i;

function windowAround(text: string, index: number, length: number): string {
  return text.slice(Math.max(0, index - 160), Math.min(text.length, index + length + 160));
}

/**
 * The "new client" window a broker panel states in its commission text:
 *   "w ciągu ostatnich dwóch lat"            -> 24 months
 *   "w ciągu 24 poprzedzających miesięcy"    -> 24 months
 *   "od 01.01.2023 r. nie był posiadaczem"   -> since 2023-01-01
 *   "nigdy nie posiadali konta Revolut"      -> never
 * null when the text says nothing like it. Never guesses.
 */
export function parseNewClientRule(text: string | null | undefined): NewClientRule | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ");

  if (/nigdy nie (posiadał|posiadala|posiadali|miał|mieli)/i.test(t)) return { kind: "never" };

  const rules: NewClientRule[] = [];

  // Fixed dates: "od 01.01.2023", "po 6 sierpnia 2026", "od 1 sierpnia 2019".
  const dateRe = /\b(od|po)\s+(?:dnia\s+)?(\d{1,2})(?:[.\s]+)(\d{1,2}|[a-ząćęłńóśźż]+)(?:[.\s]+)(\d{4})/gi;
  for (const m of t.matchAll(dateRe)) {
    if (!CLIENT_CONTEXT.test(windowAround(t, m.index ?? 0, m[0].length))) continue;
    const day = Number(m[2]);
    const month = /^\d+$/.test(m[3]!) ? Number(m[3]) : monthFromWord(m[3]!);
    const year = Number(m[4]);
    if (!month || month > 12 || day < 1 || day > 31) continue;
    rules.push({ kind: "since", date: new Date(Date.UTC(year, month - 1, day)) });
  }

  // Sliding windows: "ostatnich dwóch lat", "12 miesięcy przed złożeniem", "24 poprzedzających miesięcy".
  const yearsWord = /(?:ostatnich|poprzedzających)\s+(jednego|dwóch|dwoch|trzech)\s+(?:lat|roku)/gi;
  for (const m of t.matchAll(yearsWord)) {
    const n = NUMBER_WORDS[m[1]!.toLowerCase()];
    if (n && CLIENT_CONTEXT.test(windowAround(t, m.index ?? 0, m[0].length))) rules.push({ kind: "months", months: n * 12 });
  }
  const monthsNum = /(\d{1,2})\s+(?:poprzedzających\s+|ostatnich\s+)?miesi[ęe]c/gi;
  for (const m of t.matchAll(monthsNum)) {
    const near = windowAround(t, m.index ?? 0, m[0].length);
    if (!/(posiada|relacj|produkt|nowy|nowego|nowych)/i.test(near)) continue;
    const months = Number(m[1]);
    if (months >= 6 && months <= 60) rules.push({ kind: "months", months });
  }

  if (rules.length === 0) return null;
  // The longest window is the safest one when several are stated.
  const months = rules.filter((r): r is Extract<NewClientRule, { kind: "months" }> => r.kind === "months");
  if (months.length) return months.sort((a, b) => b.months - a.months)[0]!;
  return rules[0]!;
}

export function describeNewClientRule(rule: NewClientRule | null): string {
  if (!rule) return "okno „nowego klienta” nie jest podane w panelu";
  if (rule.kind === "never") return "tylko ten, kto nigdy nie miał konta w banku";
  if (rule.kind === "since") return `brak konta w banku od ${rule.date.toISOString().slice(0, 10).split("-").reverse().join(".")}`;
  const y = rule.months % 12 === 0 ? rule.months / 12 : null;
  return y ? `brak konta w banku przez ${y === 1 ? "1 rok" : y < 5 ? `${y} lata` : `${y} lat`}` : `brak konta w banku przez ${rule.months} mies.`;
}

export interface OwnerHistory {
  /** Any history row for this bank and account type. */
  hasRow: boolean;
  wasClientFrom?: Date | null;
  wasClientUntil?: Date | null;
  currentClient: boolean;
}

export interface CommissionEligibility {
  status: "yes" | "no" | "unknown";
  /** From this day the commission is due again (months rule). */
  from?: Date;
  text: string;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Can the owner earn the BROKER commission by opening this account himself?
 * Uses only the commission window of the broker, never the bank's promotion
 * karencja (that one is the separate "premia" answer).
 */
export function commissionEligibility(
  rule: NewClientRule | null,
  history: OwnerHistory | null,
  ownApplicationsAllowed: boolean | null | undefined,
  now: Date = new Date()
): CommissionEligibility {
  if (ownApplicationsAllowed === false) return { status: "no", text: "broker zakazuje wniosków własnych" };
  if (!rule) return { status: "unknown", text: "panel nie podaje okna nowego klienta" };
  if (history?.currentClient) return { status: "no", text: "jesteś obecnie klientem banku" };
  const never = !history || !history.hasRow || (!history.wasClientFrom && !history.wasClientUntil);

  if (rule.kind === "never") {
    return never ? { status: "unknown", text: "brak historii w Moim koncie (jeśli nigdy nie byłeś klientem: tak)" } : { status: "no", text: "byłeś już klientem banku" };
  }
  if (never) return { status: "unknown", text: "brak historii w Moim koncie (jeśli nie miałeś konta w tym oknie: tak)" };

  const until = history!.wasClientUntil;
  if (!until) return { status: "unknown", text: "brak daty zamknięcia konta" };
  const today = dayKey(now);
  if (dayKey(until) > today) return { status: "no", text: `konto jeszcze otwarte do ${fmt(until)}` };

  if (rule.kind === "since") {
    if (dayKey(until) < dayKey(rule.date)) return { status: "yes", text: `tak, konto zamknięte przed ${fmt(rule.date)}` };
    return { status: "no", text: `nie: miałeś konto po ${fmt(rule.date)} (stała data z panelu)` };
  }
  const from = new Date(until);
  from.setUTCMonth(from.getUTCMonth() + rule.months);
  if (dayKey(from) <= today) return { status: "yes", text: "tak, okno nowego klienta minęło", from };
  return { status: "no", text: `nie, od ${fmt(from)}`, from };
}

// ---------------------------------------------------------------------
// Matching a campaign to a promotion on the site
// ---------------------------------------------------------------------

/** One bank, whatever the panel calls it ("mBank dla firm", "PEKAO S.A", "Bank Credit Agricole"). */
export function normalizeBank(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(dla firm|s\.a\.?|sa|bank polski|polska|bank|group|grupa)\b/g, " ")
    .replace(/[^a-z0-9ąćęłńóśźż]+/g, "")
    .replace("creditagricole", "creditagricole")
    .replace("pekao", "pekao")
    .replace("nest!", "nest");
}

export function accountTypeFromCategory(category: string): "BUSINESS" | "SAVINGS" | "PERSONAL" {
  const c = category.toLowerCase();
  if (c.includes("firm")) return "BUSINESS";
  if (c.includes("oszcz")) return "SAVINGS";
  return "PERSONAL";
}

/** The biggest "do 5000 zł" / "nawet 1000 zł" number in a campaign name, in grosze. */
export function bonusFromName(name: string): number | null {
  const nums = [...name.matchAll(/(?:do|nawet|premii|bonus)\s*(\d[\d\s]{1,6})\s*zł/gi)].map((m) => Number(m[1]!.replace(/\s/g, "")));
  const plain = [...name.matchAll(/(\d[\d\s]{1,6})\s*zł/gi)].map((m) => Number(m[1]!.replace(/\s/g, "")));
  const all = [...nums, ...plain].filter((n) => Number.isFinite(n) && n >= 50);
  return all.length ? Math.max(...all) * 100 : null;
}

export interface MatchPromotion {
  id: string;
  name: string;
  bankName: string;
  accountType: string;
  status: string;
  maxBonusCents: number;
}

export interface PromotionMatch {
  promotion: MatchPromotion;
  score: number;
  /** The campaign title names a different amount than the promotion. */
  amountMismatch?: { campaignCents: number; promotionCents: number };
}

const STOP = new Set(["konto", "konta", "bank", "premii", "zyskaj", "nawet", "oraz", "dla", "z", "i", "w", "na", "do", "zł"]);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9ąćęłńóśźż ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
  );

/**
 * Candidate promotions for a campaign: same bank and the same kind of account
 * (personal / business / savings). Different amounts do NOT disqualify (the
 * panel title and the promotion often name different caps, e.g. 5000 vs 6000);
 * they are reported as a mismatch so the owner can see it. Only ACTIVE and
 * DRAFT promotions are candidates; the best score comes first.
 */
export function suggestPromotions(
  campaign: { bankName: string; name: string; category: string },
  promotions: MatchPromotion[]
): PromotionMatch[] {
  const bank = normalizeBank(campaign.bankName);
  const type = accountTypeFromCategory(campaign.category);
  const campaignTokens = tokens(campaign.name);
  const campaignBonus = bonusFromName(campaign.name);
  const out: PromotionMatch[] = [];
  for (const p of promotions) {
    if (p.status !== "ACTIVE" && p.status !== "DRAFT") continue;
    if (normalizeBank(p.bankName) !== bank) continue;
    const pType = p.accountType === "BUSINESS" ? "BUSINESS" : p.accountType === "SAVINGS" ? "SAVINGS" : "PERSONAL";
    if (pType !== type) continue;
    let score = 1;
    const shared = [...tokens(p.name)].filter((w) => campaignTokens.has(w)).length;
    score += shared;
    const mismatch = campaignBonus != null && campaignBonus !== p.maxBonusCents;
    if (campaignBonus != null && !mismatch) score += 2;
    out.push({ promotion: p, score, amountMismatch: mismatch ? { campaignCents: campaignBonus!, promotionCents: p.maxBonusCents } : undefined });
  }
  return out.sort((a, b) => b.score - a.score);
}
