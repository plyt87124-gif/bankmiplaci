import Link from "next/link";
import { ListChecks } from "lucide-react";
import { DeadlineBadge } from "@/components/trust/DeadlineBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { formatRatingOutOf10 } from "@/lib/format";
import { OfferCta } from "./OfferCta";
import type { OfferState } from "./offerModel";

/**
 * The panel next to the offer (sticky from lg, 22.5 rem wide): the amount (Inter
 * 600, tabular), the deadline, the main call to action with its compact
 * disclosure directly beneath, "Zapisz w ściądze" (a link to the ściąga card in
 * the conditions section) and the site rating with "Jak liczymy?".
 *
 * Below lg the amount and deadline are not repeated here (the summary bar sits
 * right above): the panel is then just the button, its disclosure and the
 * links, placed before the long text so the call to action is near the top.
 */
export function OfferAside({
  state,
  maxBonusCents,
  endDate,
  rating,
  ctaHref,
  moreOffersHref,
  moreOffersLabel,
  ratingHref,
  showChecklistLink,
  loggedIn,
  mainCtaId,
  now
}: {
  state: OfferState;
  maxBonusCents: number;
  endDate: Date | string;
  rating: number | string | { toNumber(): number };
  ctaHref: string;
  moreOffersHref: string;
  moreOffersLabel: string;
  ratingHref: string;
  /** The offer has a ściąga and is not ended: show "Zapisz w ściądze". */
  showChecklistLink: boolean;
  loggedIn: boolean;
  mainCtaId: string;
  now?: Date;
}) {
  const hasBonus = maxBonusCents > 0;

  return (
    <aside
      aria-label="Premia, termin i przejście do promocji"
      className="min-w-0 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[5.5rem]"
    >
      <div className="rounded-card border border-line bg-surface p-4 sm:p-6">
        <div className="hidden lg:block">
          <p className="type-label text-ink-500">{hasBonus ? "Premia do" : "Premia"}</p>
          {hasBonus ? (
            <Money cents={maxBonusCents} className="mt-1 block text-h1 text-ink-900" />
          ) : (
            <p className="mt-1 text-h3 font-semibold text-ink-900">Bez premii gotówkowej</p>
          )}
          {/* The deadline badge states the date AND the days left; its colour (warning <= 14 days, red <= 3 /
              ended) only supports the words and the icon. */}
          <DeadlineBadge endDate={endDate} now={now} detailed className="mt-3 max-w-full" />
        </div>

        <OfferCta
          state={state}
          href={ctaHref}
          moreOffersHref={moreOffersHref}
          moreOffersLabel={moreOffersLabel}
          id={mainCtaId}
          className="lg:mt-5"
        />

        {showChecklistLink ? (
          <ButtonLink href="#sciaga" variant="secondary" fullWidth className="mt-3">
            <ListChecks size={18} aria-hidden="true" className="shrink-0" />
            {loggedIn ? "Zapisz w ściądze" : "Zapisz w ściądze (wymaga konta)"}
          </ButtonLink>
        ) : null}

        <div className="mt-5 border-t border-line pt-4 text-small">
          <p className="text-ink-700">
            Ocena serwisu <span className="num font-semibold text-ink-900">{formatRatingOutOf10(rating)}</span>
          </p>
          <Link href={ratingHref} className="link-inline -my-2 inline-flex min-h-11 items-center font-medium">
            Jak liczymy?
          </Link>
        </div>
      </div>
    </aside>
  );
}
