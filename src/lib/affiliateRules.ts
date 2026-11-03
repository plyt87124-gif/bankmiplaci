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
  // An account you still have rules you out under any new-client window, even one the panel does not state.
  if (history?.currentClient) return { status: "no", text: "jesteś obecnie klientem banku" };
  if (history?.wasClientUntil && dayKey(history.wasClientUntil) > dayKey(now)) return { status: "no", text: `konto jeszcze otwarte do ${fmt(history.wasClientUntil)}` };
  if (!rule) return { status: "unknown", text: "panel nie podaje okna nowego klienta" };
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
// When the commission must be earned
// ---------------------------------------------------------------------

export interface CommissionDeadline {
  /** Last day to meet the broker's conditions when the application and agreement happen on `openedAt`. */
  date: Date;
  /** The panel's wording the date comes from, e.g. "3 płatności w 30 dni od umowy". */
  basis: string;
}

const addDaysUtc = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
/** Last day of the calendar month `n` months after `d` (n = 0: the same month). */
const endOfMonthUtc = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0));
const NUM_WORD: Record<string, number> = { jednego: 1, miesiąca: 1, dwóch: 2, dwoch: 2, trzech: 3 };

/**
 * The commission deadline the panel's text implies for an account applied for
 * and opened on `openedAt` (the latest of all the deadlines it states):
 *   "w ciągu 30 dni od podpisania umowy"                    -> +30 days
 *   "w terminie 30 dni od daty wypełnienia wniosku"         -> +30 days
 *   "w ciągu miesiąca od daty otwarcia"                     -> +1 month
 *   "do końca pierwszego pełnego miesiąca kalendarzowego"   -> end of next month
 *   "w miesiącu następującym po otwarciu"                   -> end of next month
 *   "w jednym z dwóch pierwszych miesięcy po otwarciu"      -> end of the 2nd month
 *   "musi pozostać otwarte przez min. 60 dni"               -> +60 days
 * null when the text names no deadline (commission for the agreement alone).
 */
export function commissionDeadline(text: string | null | undefined, openedAt: Date): CommissionDeadline | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ");
  const found: CommissionDeadline[] = [];
  const quote = (m: RegExpMatchArray) => m[0].trim().replace(/^(w|do)\s/i, (s) => s.toLowerCase());

  for (const m of t.matchAll(/(?:w ciągu|w terminie|przez min\.?|przez minimum|przez co najmniej)\s+(?:pierwszych\s+)?(\d{1,3})\s+dni/gi)) {
    found.push({ date: addDaysUtc(openedAt, Number(m[1])), basis: quote(m) });
  }
  for (const m of t.matchAll(/w ciągu (jednego|dwóch|dwoch|trzech)?\s*(?:miesiąca|miesięcy) od/gi)) {
    const n = m[1] ? NUM_WORD[m[1].toLowerCase()] ?? 1 : 1;
    const d = new Date(openedAt);
    d.setUTCMonth(d.getUTCMonth() + n);
    found.push({ date: d, basis: quote(m).replace(/ od$/, "") });
  }
  for (const m of t.matchAll(/do końca pierwszego pełnego miesiąca kalendarzowego/gi)) found.push({ date: endOfMonthUtc(openedAt, 1), basis: quote(m) });
  for (const m of t.matchAll(/w miesiącu następującym po (?:otwarciu|miesiącu otwarcia)/gi)) found.push({ date: endOfMonthUtc(openedAt, 1), basis: quote(m) });
  for (const m of t.matchAll(/w jednym z (dwóch|trzech) pierwszych miesięcy po otwarciu/gi)) {
    found.push({ date: endOfMonthUtc(openedAt, m[1]!.toLowerCase() === "trzech" ? 3 : 2), basis: quote(m) });
  }
  if (!found.length) return null;
  return found.sort((a, b) => b.date.getTime() - a.date.getTime())[0]!;
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

// ---- promoting a campaign: what the network and the bank forbid ----

export interface PromoRestriction {
  key: string;
  label: string;
}

const RESTRICTIONS: { key: string; label: string; re: RegExp }[] = [
  { key: "sem", label: "zakaz reklam w wyszukiwarkach (SEM)", re: /\bSEM\b|AdWords|wyszukiwark\w* internetow/i },
  { key: "brand", label: "zakaz licytowania nazwy banku (brand bidding)", re: /brand bidding|nazw\w* (marki|banku) (w kampaniach|jako słów)/i },
  { key: "creatives", label: "zakaz własnych grafik z marką banku", re: /własnych kreacji|tworzenie grafik|materiałów wizualnych/i },
  { key: "mailing", label: "zakaz mailingu", re: /mailing/i },
  { key: "sms", label: "zakaz SMS", re: /\bSMS\b/ },
  { key: "shortener", label: "zakaz skracaczy linków", re: /skracacz/i },
  { key: "blogs", label: "zakaz na blogach o promocjach bankowych", re: /blogach opisujących promocje/i },
  { key: "onBehalf", label: "zakaz wniosków w imieniu klienta", re: /w imieniu klienta|wypełniony samodzielnie przez osobę zainteresowaną/i },
  { key: "incentive", label: "zakaz zachęt typu praca, testy, ruch motywowany", re: /ofert\w* zatrudnienia|ruchu motywowanego|tajemniczego klienta/i },
  { key: "ip", label: "jeden wniosek z jednego adresu IP", re: /jednego adresu IP/i }
];

/** The promoting restrictions named in a campaign's panel text (notes + conditions), in a fixed order. */
export function promoRestrictions(text: string | null | undefined): PromoRestriction[] {
  if (!text) return [];
  return RESTRICTIONS.filter((r) => r.re.test(text)).map(({ key, label }) => ({ key, label }));
}

/**
 * Rules from the networks' own regulamins that hold for every campaign (read
 * 4.11.2026: ebrokerpartner.pl/regulamin, comperialead.pl/regulamin.html).
 * Neither forbids a partner's own application outright.
 */
export const NETWORK_RULES: Record<"EBROKER" | "COMPERIA", { own: string; promo: string[] }> = {
  EBROKER: {
    own: "Regulamin nie zakazuje wniosku na siebie. Zakazuje wniosków bez rzeczywistego zainteresowania produktem (tylko dla prowizji) i powtórnych wniosków z tego samego urządzenia.",
    promo: [
      "materiały reklamowe tylko na własnej stronie; poza nią (np. link afiliacyjny w opisie wideo) tylko za zgodą eBrokera",
      "nie zmieniać materiałów reklamowych bez zgody",
      "nie zakładać stron ani profili w social mediach z nazwą programu lub „Rankomat”",
      "nie działać na profilach banku w social mediach",
      "stawki prowizji są poufne"
    ]
  },
  COMPERIA: {
    own: "Regulamin nie zakazuje wniosku na siebie. Kampanie liczą jeden wniosek z jednego adresu IP.",
    promo: ["nie używać znaku ani treści Comperia.pl bez zgody", "mailingi z narzędziami Comperii wymagają akceptacji (mailing@comperia.pl)", "zakaz nieuczciwego pozycjonowania i spamu"]
  }
};

// ---- the same account offered by both networks ----

export interface OffSiteItem {
  network: string;
  bankName: string;
  name: string;
  category: string;
}

function nameTokens(item: OffSiteItem): Set<string> {
  const bankWords = new Set([...tokens(item.bankName), ...tokens(item.bankName.replace(/bank/gi, " "))]);
  return new Set([...tokens(item.name)].filter((w) => !bankWords.has(w) && w !== "osobiste" && w !== "firmowe"));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / (a.size + b.size - shared);
}

/**
 * Groups campaigns without a promotion on the site so that one account is one
 * row: the other network's campaign for the same bank and kind of account,
 * when each network has only one such account or the names match closely,
 * and same-named duplicates within a network. First-appearance order is kept.
 */
export function groupOffSiteItems<T extends OffSiteItem>(items: T[]): T[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const bucket = (t: T) => `${normalizeBank(t.bankName)}|${accountTypeFromCategory(t.category)}`;
  const toks = items.map(nameTokens);
  const key = (i: number) => [...toks[i]!].sort().join(" ");
  // Distinct account names per network within a bank + account kind.
  const distinct = (b: string, network: string) => new Set(items.map((x, i) => (bucket(x) === b && x.network === network ? key(i) : null)).filter((k) => k !== null)).size;
  // Cross-network candidates, best match first, each campaign paired once.
  const candidates: { i: number; j: number; score: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (bucket(a) !== bucket(b)) continue;
      const sim = jaccard(toks[i]!, toks[j]!);
      if (a.network === b.network) {
        if (sim === 1) union(i, j);
        continue;
      }
      const onlyOne = distinct(bucket(a), a.network) === 1 && distinct(bucket(b), b.network) === 1;
      if (onlyOne || sim >= 0.5) candidates.push({ i, j, score: onlyOne ? 2 : sim });
    }
  }
  const paired = new Set<number>();
  for (const { i, j } of candidates.sort((x, y) => y.score - x.score)) {
    if (paired.has(i) || paired.has(j)) continue;
    union(i, j);
    paired.add(i);
    paired.add(j);
  }
  const out = new Map<number, T[]>();
  items.forEach((t, i) => out.set(find(i), [...(out.get(find(i)) ?? []), t]));
  return [...out.values()];
}
