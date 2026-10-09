import { formatPLN } from "@/lib/format";
import { cn } from "@/lib/cn";

const NBSP = "\u00A0";

/** "1500" for whole zloty, "1500,50" when there are grosze. pl-PL groups 5+ digit numbers with a non-breaking space. */
function formatNumberPart(cents: number): string {
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

/**
 * Inline amount for tables, side panels, comparison cells: Inter 600 with
 * tabular lining digits, `1 500 zł` never breaking across lines. Amounts are
 * integer grosze, as everywhere in the app. `null`/`undefined` is rendered as
 * "Brak danych" - NEVER as 0 zł (unverified is not free).
 */
export function Money({
  cents,
  className,
  emptyLabel = "Brak danych"
}: {
  cents: number | null | undefined;
  className?: string;
  emptyLabel?: string;
}) {
  if (cents == null || !Number.isFinite(cents)) {
    return <span className={cn("text-ink-500", className)}>{emptyLabel}</span>;
  }
  return <span className={cn("num whitespace-nowrap font-body font-semibold", className)}>{formatPLN(cents)}</span>;
}

/**
 * The "hero" amount: serif (`--font-amount`), lining + tabular digits, with a
 * smaller "zł" (0.5 em, weight 500) after a non-breaking space.
 *   variant "card" -> 36/40 (offer card)
 *   variant "stat" -> 44/46, 56/58 from md (offer hero, side panel)
 * Use ONLY for the premium amount; any other number is <Money>. Static - never
 * animate it (decision-relevant data does not count up).
 * Missing value -> "Brak danych" (never 0 zł).
 */
export function Amount({
  cents,
  variant = "card",
  className,
  emptyLabel = "Brak danych"
}: {
  cents: number | null | undefined;
  variant?: "card" | "stat";
  className?: string;
  emptyLabel?: string;
}) {
  if (cents == null || !Number.isFinite(cents)) {
    return <span className={cn("font-body text-ui font-semibold text-ink-500", className)}>{emptyLabel}</span>;
  }

  const figure = formatNumberPart(cents);
  const typeClass = variant === "stat" ? "type-stat" : "type-amount";

  return (
    // One plain text run "1500<nbsp>zł": screen readers, copy-paste and search
    // engines all see the same string; only the "zł" is drawn smaller.
    <span className={cn(typeClass, "whitespace-nowrap text-ink-900", className)}>
      {figure}
      {NBSP}
      <span className="text-[0.5em] font-medium">zł</span>
    </span>
  );
}
