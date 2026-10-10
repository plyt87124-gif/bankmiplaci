/**
 * ONE reading of a fee (account / card) for every place that words it: the
 * offer page (fees table, summary bar, FAQ), the schema.org JSON-LD, the offer
 * card of the listing and the comparison table. It replaces the four copies of
 * the same rule those places used to carry, so the page and its structured data
 * can no longer say different things about the same fee.
 *
 * Pure: no React, no database. Input is what the Fees row stores
 * (prisma/schema.prisma, model Fees):
 *
 *   cents      the rate charged WHEN the waiver condition is NOT met (0 when
 *              there is none). NULL = not verified - never "free".
 *   waiver     the waiver condition (free text). The waived rate is always 0 by
 *              definition, so 0 zl together with a condition is contradictory.
 *   caveat     Fees.otherFee (free text) or a ready yes/no. The convention of
 *              the site: the number is the BEST case and the catch is described
 *              in otherFee. A bare "0 zl" next to such a remark would overstate
 *              it, so it reads "od 0 zl".
 *
 * Resulting kinds:
 *
 *   unknown      cents null / negative / not finite, or 0 zl WITH a condition
 *                (the real rate is not known)        label "Brak danych"
 *   free         0 zl, no condition                  label "0 zl"
 *                ... and a caveat exists             label "od 0 zl" (hasCaveat)
 *   paid         12 zl, no condition                 label "12 zl"
 *   conditional  12 zl, with a waiver condition      label "12 zl" + waiverNote
 *                                                    "0 zl po spelnieniu warunku"
 *
 * Money is formatted by formatPLN (non-breaking space between the number and
 * "zl"); callers that need plain spaces (JSON-LD) normalise them.
 */
import { formatPLN } from "@/lib/format";
import { truncateAtWord } from "@/lib/seo/text";

const NBSP = " ";

export type FeeKind = "unknown" | "free" | "paid" | "conditional";

export interface FeeModel {
  kind: FeeKind;
  /** The rate to print; null when unknown (print the label, never 0 zl). */
  cents: number | null;
  /** Waiver condition, whitespace collapsed; null when there is none. Kept for `unknown` too, to say what is known. */
  waiver: string | null;
  /**
   * The number is the best case and Fees.otherFee describes the catch. Always
   * false for `unknown` (there is no number to qualify).
   */
  hasCaveat: boolean;
  /** Short value: "Brak danych" / "0 zł" / "od 0 zł" / "12 zł". */
  label: string;
  /** What follows the waived rate in a note: "0 zł po spełnieniu warunku" for `conditional`, else null. */
  waiverNote: string | null;
  /**
   * The value as a clause for prose (FAQ answer, fee specification of the
   * JSON-LD): "0 zł", "od 0 zł, zależnie od warunków opisanych w taryfie
   * banku", "12 zł (0 zł po spełnieniu warunku: ...)", or "brak danych –
   * sprawdź tabelę opłat banku".
   */
  sentence: string;
}

export const FEE_UNKNOWN_LABEL = "Brak danych";
export const FEE_UNKNOWN_SENTENCE = "brak danych – sprawdź tabelę opłat banku";
export const FEE_WAIVER_NOTE = `0${NBSP}zł po spełnieniu warunku`;
/** Longest waiver condition quoted inside a sentence. */
export const FEE_SENTENCE_CONDITION_MAX = 200;

function cleanText(text: string | null | undefined): string | null {
  const collapsed = text?.replace(/\s+/g, " ").trim();
  return collapsed ? collapsed : null;
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.;,:\s]+$/, "");
}

/** otherFee text, or a ready yes/no -> is there a caveat? Blank text is none. */
export function hasFeeCaveat(caveat: string | boolean | null | undefined): boolean {
  return typeof caveat === "boolean" ? caveat : cleanText(caveat) !== null;
}

export function resolveFee(
  cents: number | null | undefined,
  waiverCondition?: string | null,
  caveat?: string | boolean | null
): FeeModel {
  const waiver = cleanText(waiverCondition);

  if (cents == null || !Number.isFinite(cents) || cents < 0) {
    return unknownFee(waiver);
  }

  if (cents === 0) {
    // 0 zl + a waiver condition contradicts itself (the condition would waive nothing).
    if (waiver) return unknownFee(waiver);
    const caveated = hasFeeCaveat(caveat);
    return {
      kind: "free",
      cents: 0,
      waiver: null,
      hasCaveat: caveated,
      label: caveated ? `od${NBSP}${formatPLN(0)}` : formatPLN(0),
      waiverNote: null,
      sentence: caveated ? `od ${formatPLN(0)}, zależnie od warunków opisanych w taryfie banku` : formatPLN(0)
    };
  }

  const amount = formatPLN(cents);
  const caveated = hasFeeCaveat(caveat);
  if (waiver) {
    const condition = truncateAtWord(stripTrailingPunctuation(waiver), FEE_SENTENCE_CONDITION_MAX);
    return {
      kind: "conditional",
      cents,
      waiver,
      hasCaveat: caveated,
      label: amount,
      waiverNote: FEE_WAIVER_NOTE,
      sentence: `${amount} (${FEE_WAIVER_NOTE}: ${condition})`
    };
  }
  return { kind: "paid", cents, waiver: null, hasCaveat: caveated, label: amount, waiverNote: null, sentence: amount };
}

function unknownFee(waiver: string | null): FeeModel {
  return {
    kind: "unknown",
    cents: null,
    waiver,
    hasCaveat: false,
    label: FEE_UNKNOWN_LABEL,
    waiverNote: null,
    sentence: FEE_UNKNOWN_SENTENCE
  };
}
