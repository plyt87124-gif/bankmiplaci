import Link from "next/link";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  COMPACT,
  FOOTER,
  SORT_RECOMMENDED_LABEL,
  TAG_RECOMMENDED_DESCRIPTION,
  isRecommendedSort,
  sortDescriptionCopy,
  stripCopy,
  type DisclosureCopy
} from "@/lib/disclosureCopy";

/**
 * Affiliate / ranking disclosure (docs/redesign-v2/04-trust-and-disclosure-plan.md).
 * A server component: no JS, no state, the text is always in the HTML and is
 * never collapsed on mobile. Wording lives ONLY in lib/disclosureCopy.ts.
 * Colour is ink-700 / ink-500 or darker (>= 5.5:1 in both themes), size >= 13 px.
 *
 *   strip    above EVERY list of offers (home, /promocje, /porownaj, hubs, banks).
 *            Wording depends on the active `sort`: "recommended" (also when no
 *            sort is given, as the listing does) says the order depends on the
 *            rating AND on partner remuneration (so a lower-rated offer can
 *            rank higher) while the rating itself is computed without it; any
 *            other order carries the general affiliate sentence.
 *   compact  directly under EVERY button that leads to a bank (offer aside,
 *            bottom CTA, sticky mobile bar, comparison table).
 *   tag      the sort option and the description of the active sort:
 *            by default "Polecane (z wynagrodzeniem)" for
 *            "recommended" and a one-line description for the other orders;
 *            `long` swaps the "recommended" label for a short description that
 *            only adds what the strip does not say (remuneration acts in this
 *            sort order and in no other).
 *   footer   the site-wide statement in the footer.
 *
 * Every instance carries `data-disclosure="<variant>"` so end-to-end checks
 * can assert "a strip above the list, a compact under each /out/ link".
 */
export type DisclosureVariant = "strip" | "compact" | "footer" | "tag";

interface AffiliateDisclosureProps {
  variant: DisclosureVariant;
  /** Active sort order (SortKey). Used by `strip` and `tag`; ignored by the others. */
  sort?: string | null;
  /** `tag` only: show the full description even for "recommended". */
  long?: boolean;
  className?: string;
}

function CopyWithLink({ copy }: { copy: DisclosureCopy }) {
  return (
    <>
      {copy.lead}{" "}
      <Link href={copy.href} className="link-inline whitespace-nowrap font-medium">
        {copy.linkLabel}
      </Link>
    </>
  );
}

export function AffiliateDisclosure({ variant, sort, long = false, className }: AffiliateDisclosureProps) {
  switch (variant) {
    case "strip":
      return (
        <div
          data-disclosure="strip"
          data-disclosure-sort={isRecommendedSort(sort) ? "recommended" : "other"}
          className={cn(
            "flex items-start gap-3 rounded-field border border-line bg-sunken px-4 py-3 text-small text-ink-700",
            className
          )}
        >
          <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
          <p>
            <CopyWithLink copy={stripCopy(sort)} />
          </p>
        </div>
      );

    case "compact":
      return (
        <p
          data-disclosure="compact"
          className={cn("mt-2 flex items-start gap-1.5 text-small text-ink-500", className)}
        >
          <Info size={14} aria-hidden="true" className="mt-[5px] shrink-0" />
          <span>
            <CopyWithLink copy={COMPACT} />
          </span>
        </p>
      );

    case "footer":
      return (
        <p data-disclosure="footer" className={cn("max-w-[68ch] text-small text-ink-500", className)}>
          <CopyWithLink copy={FOOTER} />
        </p>
      );

    case "tag": {
      if (isRecommendedSort(sort) && !long) {
        return (
          <span data-disclosure="tag" className={cn("text-small text-ink-500", className)}>
            {SORT_RECOMMENDED_LABEL}
          </span>
        );
      }
      const copy = isRecommendedSort(sort) ? TAG_RECOMMENDED_DESCRIPTION : sortDescriptionCopy(sort);
      return (
        <p data-disclosure="tag" className={cn("text-small text-ink-500", className)}>
          <CopyWithLink copy={copy} />
        </p>
      );
    }
  }
}
