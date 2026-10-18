import Link from "next/link";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { PromotionCard, type PromotionCardData } from "@/components/PromotionCard";

/**
 * "Inne promocje {banku}" under a current offer, "Aktualne promocje {banku}"
 * under an ended one (that is the way out of a dead end). The cards are the
 * listing's cards (public data only: no partner link, no commission), in the
 * "Polecane" order - which takes partner remuneration into account, so the
 * disclosure strip for that order sits above them like above every list.
 *
 * Several offers of one bank are common (Alior, PKO, mBank): each card links to
 * its own page. An ended offer whose bank has nothing current says so and sends
 * the reader to the list of all offers.
 */
export function BankOffers({
  bankName,
  offers,
  ended,
  allOffersHref
}: {
  bankName: string;
  offers: readonly PromotionCardData[];
  ended: boolean;
  /** The bank's whole list of offers (/banki/{slug} once it exists, else /promocje?bank=...). */
  allOffersHref: string;
}) {
  if (offers.length === 0 && !ended) return null;

  const heading = ended ? `Aktualne promocje ${bankName}` : `Inne promocje ${bankName}`;

  return (
    <section id="inne-promocje" aria-labelledby="inne-promocje-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="inne-promocje-h">{heading}</h2>
        {offers.length > 0 ? (
          <Link href={allOffersHref} className="link-inline inline-flex min-h-11 items-center text-small font-medium">
            Wszystkie promocje {bankName}
          </Link>
        ) : null}
      </div>

      {offers.length > 0 ? (
        <>
          <AffiliateDisclosure variant="strip" sort="recommended" className="mt-4" />
          <ul role="list" className="mt-5 grid gap-4 sm:grid-cols-2">
            {offers.map((offer) => (
              <li key={offer.slug} className="min-w-0">
                <PromotionCard promotion={offer} priority={false} headingLevel={3} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-article text-ink-700">
          {bankName} nie ma teraz aktualnych promocji w naszym zestawieniu.{" "}
          <Link href="/promocje" className="link-inline font-medium">
            Zobacz aktualne promocje innych banków
          </Link>
          .
        </p>
      )}
    </section>
  );
}
