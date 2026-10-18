import type { ReactNode } from "react";
import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";
import { Money } from "@/components/ui/Money";
import { formatRatingOutOf10 } from "@/lib/format";
import { OfferCta } from "./OfferCta";
import type { OfferState } from "./offerModel";

/**
 * The panel next to the offer (sticky from lg, 22.5 rem wide): the amount (Inter
 * 600, tabular), the deadline, the main call to action with its compact
 * disclosure directly beneath, "Poleć znajomemu", the ściąga card as its own tile and the site rating with "Jak liczymy?".
 *
 * Below lg the amount and deadline are not repeated here (the summary bar sits
 * right above): the panel is then just the button, its disclosure and the
 * links, placed before the long text so the call to action is near the top.
 */
export function OfferAside({
  state,
  maxBonusCents,
  rating,
  ctaHref,
  moreOffersHref,
  moreOffersLabel,
  ratingHref,
  shareUrl,
  shareTitle,
  checklist,
  mainCtaId
}: {
  state: OfferState;
  maxBonusCents: number;
  endDate?: Date | string;
  rating: number | string | { toNumber(): number };
  ctaHref: string;
  moreOffersHref: string;
  moreOffersLabel: string;
  ratingHref: string;
  shareUrl: string;
  shareTitle: string;
  /** The ściąga card (JoinChecklistButton): its own tile under the main one; null when the offer has no ściąga. */
  checklist: ReactNode;
  mainCtaId: string;
  now?: Date;
}) {
  const hasBonus = maxBonusCents > 0;

  return (
    <aside
      aria-label="Premia, termin i przejście do promocji"
      className="min-w-0 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto"
    >
      <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <div className="hidden lg:block">
          <p className="type-label text-ink-500">{hasBonus ? "Premia do" : "Premia"}</p>
          {hasBonus ? (
            <Money cents={maxBonusCents} className="mt-1 block text-h1 text-ink-900" />
          ) : (
            <p className="mt-1 text-h3 font-semibold text-ink-900">Bez premii gotówkowej</p>
          )}
        </div>

        <OfferCta
          state={state}
          href={ctaHref}
          moreOffersHref={moreOffersHref}
          moreOffersLabel={moreOffersLabel}
          id={mainCtaId}
          className="lg:mt-5"
        />

        <ShareButton url={shareUrl} title={shareTitle} fullWidth className="mt-3" />

        <p className="mt-4 flex flex-wrap items-center gap-x-2 border-t border-line pt-3 text-small text-ink-700">
          <span>
            Ocena serwisu <span className="num font-semibold text-ink-900">{formatRatingOutOf10(rating)}</span>
          </span>
          <Link href={ratingHref} className="link-inline font-medium">
            Jak liczymy?
          </Link>
        </p>

        {/* The ściąga is part of the same panel (one tile fits a laptop screen); subtle, below the rating. */}
        {checklist ? (
          <div id="sciaga" className="mt-3 scroll-mt-20 border-t border-line pt-3">
            {checklist}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
