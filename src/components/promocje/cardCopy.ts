/**
 * Wording and small decisions of the offer card (PromotionCard), kept as pure
 * functions so they are unit-tested without rendering and reused by anything
 * else that has to say the same thing (listing, hubs, bank pages).
 */
import { formatPLN } from "@/lib/format";
import { isRouteLive } from "@/lib/seo/routes";

const NBSP = "\u00A0";

export type AccountFeeKind = "free" | "conditional" | "paid" | "unknown";

export interface AccountFeeLine {
  kind: AccountFeeKind;
  /** What follows "Opłata za konto:" - the rate. */
  text: string;
  /** Said after the rate, in parentheses ("0 zł po spełnieniu warunku"); only for a conditional fee. */
  note?: string;
}

/**
 * The account fee as the card shows it. The Fees row stores the rate charged
 * WHEN the waiver condition is NOT met; the waived rate is always 0 (see Fees
 * in prisma/schema.prisma), so:
 *
 *   no Fees row / fee not verified (null)      -> "Brak danych"   (never 0 zł)
 *   0 zł and no condition                      -> "0 zł"          (confirmed free)
 *   0 zł WITH a condition (contradictory data) -> "Brak danych"   (the real rate is unknown)
 *   12 zł and no condition                     -> "12 zł"
 *   12 zł with a condition                     -> "12 zł" + note "0 zł po spełnieniu warunku"
 */
export function describeAccountFee(
  fees: { accountFeeCents: number | null; accountFeeWaiverCondition?: string | null } | null | undefined
): AccountFeeLine {
  const unknown: AccountFeeLine = { kind: "unknown", text: "Brak danych" };
  if (!fees || fees.accountFeeCents == null) return unknown;
  const hasCondition = Boolean(fees.accountFeeWaiverCondition?.trim());
  if (fees.accountFeeCents === 0) return hasCondition ? unknown : { kind: "free", text: formatPLN(0) };
  const amount = formatPLN(fees.accountFeeCents);
  return hasCondition
    ? { kind: "conditional", text: amount, note: `0${NBSP}zł po spełnieniu warunku` }
    : { kind: "paid", text: amount };
}

/**
 * The one line under the amount: the first step of the offer ("Krok 1: ..."),
 * which is the first condition by its order, or - when the offer has no
 * conditions yet - the summary. Whitespace is collapsed; null when there is
 * neither (nothing is invented).
 */
export function cardLeadLine(
  conditions: readonly { title: string }[] | null | undefined,
  summary: string | null | undefined
): string | null {
  const first = conditions?.[0]?.title.replace(/\s+/g, " ").trim();
  if (first) return `Krok 1: ${first}`;
  const text = summary?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

/**
 * Whether the card can show the bank's logo image: an https URL or a path on
 * this site (the same rule as BankLogo, which draws a monogram otherwise). When
 * it cannot, the card prints the bank's name above the title instead, so the
 * bank is always named on screen.
 */
export function hasShowableLogo(url: string | null | undefined): boolean {
  return typeof url === "string" && (url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//")));
}

/**
 * Target of "Jak liczymy?": the methodology page once it is live, until then
 * the rating section of "Jak zarabiamy" (which exists today).
 */
export function ratingExplainerHref(): string {
  return isRouteLive("/metodologia") ? "/metodologia" : "/jak-zarabiamy#ocena";
}
