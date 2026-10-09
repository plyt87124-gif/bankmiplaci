/**
 * Pure logic of /porownaj (no React, no database): which offers are compared,
 * which cell is "the best in its row", and how a fee or a karencja is worded.
 * Covered by tests/compare.test.tsx.
 *
 * Rules that matter to a reader:
 *  - A fee is only "free" when it was verified as 0 zl WITHOUT a condition.
 *    Unknown (no Fees row, a blank value, or 0 zl with a waiver condition that
 *    contradicts it) is "Brak danych", never 0 zl.
 *  - "Best in the row" marks the best value(s) only when at least two offers
 *    have a known value and they are not all equal (a row of identical values
 *    has no winner). Ties are all marked.
 */
import { pluralizePl, formatDatePL } from "@/lib/format";

export const COMPARE_MAX = 4;

export type CompareSegment = "PERSONAL" | "BUSINESS";

export const SEGMENT_LABEL: Record<CompareSegment, string> = {
  PERSONAL: "Osobiste",
  BUSINESS: "Firmowe"
};

/** `?typ=` value -> segment; anything else is "no choice". */
export function parseSegment(value: string | string[] | undefined): CompareSegment | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "PERSONAL" || v === "BUSINESS" ? v : undefined;
}

/** Only BUSINESS accounts are "firmowe"; PERSONAL, SAVINGS, YOUNG and JOINT are "osobiste". */
export function segmentOf(accountType: string): CompareSegment {
  return accountType === "BUSINESS" ? "BUSINESS" : "PERSONAL";
}

/** `?oferty=a,b,c` -> unique, trimmed slugs in the given order. */
export function parseSlugList(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const part of raw.split(",")) {
    const slug = part.trim();
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }
  return slugs;
}

export interface Selection<T extends { slug: string; accountType: string }> {
  segment: CompareSegment;
  /** Every offer of the segment, in the order given (rating order). */
  pool: T[];
  /** The compared offers, in pool order. */
  selected: T[];
  /** True when the URL named no (valid) offers: the top of the pool is shown. */
  isDefault: boolean;
}

/**
 * Decides what is compared. `cards` must already be in the display order
 * (best rating first). With `?oferty=` the first `max` valid slugs of the
 * segment are used (in pool order); otherwise the first `max` of the pool.
 * Without `?typ=`, the segment of the first valid requested offer decides, so a
 * link such as the quiz's "Porównaj te 3" works for business offers too.
 */
export function resolveSelection<T extends { slug: string; accountType: string }>(
  cards: readonly T[],
  params: { typ?: string | string[]; oferty?: string | string[] },
  max: number = COMPARE_MAX
): Selection<T> {
  const requested = parseSlugList(params.oferty);
  const bySlug = new Map(cards.map((c) => [c.slug, c] as const));

  let segment = parseSegment(params.typ);
  if (!segment) {
    const first = requested.map((slug) => bySlug.get(slug)).find((c) => c !== undefined);
    segment = first ? segmentOf(first.accountType) : "PERSONAL";
  }

  const pool = cards.filter((c) => segmentOf(c.accountType) === segment);
  const poolSlugs = new Set(pool.map((c) => c.slug));
  const chosen = new Set(requested.filter((slug) => poolSlugs.has(slug)).slice(0, max));

  if (chosen.size === 0) return { segment, pool, selected: pool.slice(0, max), isDefault: true };
  return { segment, pool, selected: pool.filter((c) => chosen.has(c.slug)), isDefault: false };
}

/** `/porownaj?...` for a segment and a custom selection (defaults leave the query out). */
export function compareUrl(segment: CompareSegment, slugs: readonly string[] | null): string {
  const params: string[] = [];
  if (segment === "BUSINESS") params.push("typ=BUSINESS");
  if (slugs && slugs.length > 0) params.push(`oferty=${slugs.map(encodeURIComponent).join(",")}`);
  return params.length > 0 ? `/porownaj?${params.join("&")}` : "/porownaj";
}

/* ------------------------------------------------------------------ */
/* Best value in a row                                                 */
/* ------------------------------------------------------------------ */

/**
 * Which columns hold the best value of a row. `null` = unknown (never best).
 * No column is flagged when fewer than two values are known or all known
 * values are equal.
 */
export function bestFlags(values: readonly (number | null)[], prefer: "max" | "min"): boolean[] {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (known.length < 2) return values.map(() => false);
  const best = prefer === "max" ? Math.max(...known) : Math.min(...known);
  if (known.every((v) => v === best)) return values.map(() => false);
  return values.map((v) => v !== null && Number.isFinite(v) && v === best);
}

/* ------------------------------------------------------------------ */
/* Fees                                                                */
/* ------------------------------------------------------------------ */

export type FeeView =
  | { kind: "unknown" }
  /** Verified 0 zl, no condition. */
  | { kind: "free" }
  /** A fee without a waiver condition. */
  | { kind: "paid"; cents: number }
  /** A fee that is 0 zl once the condition is met. */
  | { kind: "conditional"; cents: number; condition: string };

/**
 * `cents` = the fee charged when the waiver condition is NOT met (0 when there
 * is none); the waived fee is 0 by definition (see Fees in schema.prisma).
 * null -> unknown. 0 together with a condition is contradictory -> unknown
 * (the same reading as formatFeeCompact).
 */
export function describeFee(cents: number | null | undefined, waiverCondition?: string | null): FeeView {
  if (cents == null || !Number.isFinite(cents)) return { kind: "unknown" };
  const condition = waiverCondition?.trim() ?? "";
  if (cents === 0) return condition ? { kind: "unknown" } : { kind: "free" };
  return condition ? { kind: "conditional", cents, condition } : { kind: "paid", cents };
}

/** Rank for "best": only a verified unconditional 0 zl wins; unknown is excluded. */
export function feeRank(fee: FeeView): number | null {
  if (fee.kind === "unknown") return null;
  return fee.kind === "free" ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* Karencja                                                            */
/* ------------------------------------------------------------------ */

/**
 * Lines for the "Karencja" row from the structured fields. Both can be set
 * (the user must pass both checks). None set -> `[]` and the cell says
 * "Brak danych": we never claim that there is no karencja.
 */
export function cooldownLines(cooldownMonths: number | null | undefined, cutoff: Date | string | null | undefined): string[] {
  const lines: string[] = [];
  if (cooldownMonths != null && Number.isFinite(cooldownMonths) && cooldownMonths > 0) {
    lines.push(
      `${cooldownMonths} ${pluralizePl(cooldownMonths, "miesiąc", "miesiące", "miesięcy")} od zamknięcia konta w tym banku`
    );
  }
  if (cutoff != null) {
    const text = formatDatePL(cutoff);
    if (text) lines.push(`Bez konta w tym banku od ${text}`);
  }
  return lines;
}
