import { TrustNote } from "@/components/trust/TrustNote";
import { OfferCta } from "./OfferCta";
import type { OfferState } from "./offerModel";

/**
 * Closing block of an offer page: a second call to action (a distinct tracking
 * source, so the admin click report can tell the positions apart) and the
 * standing statement "Nie jesteśmy bankiem ani doradcą. Warunki ustala bank."
 */
export function EndCta({
  state,
  bankName,
  href,
  moreOffersHref,
  moreOffersLabel
}: {
  state: OfferState;
  bankName: string;
  href: string;
  moreOffersHref: string;
  moreOffersLabel: string;
}) {
  const text = state.ctaLive
    ? `Warunki już sprawdzone? Przejdź bezpośrednio do wniosku na stronie ${bankName}.`
    : "Ta oferta nie jest obecnie dostępna przez Bankmiplaci.";

  return (
    <section aria-label="Przejdź do promocji" className="mt-12 rounded-card border border-line bg-surface p-5 text-center sm:p-8 md:mt-16">
      <p className="mx-auto max-w-xl text-ui text-ink-700">{text}</p>
      <OfferCta
        state={state}
        href={href}
        moreOffersHref={moreOffersHref}
        moreOffersLabel={moreOffersLabel}
        className="mx-auto mt-5 max-w-sm"
        disclosureClassName="justify-center text-left"
      />
      <TrustNote kind="notBank" className="mt-6" />
    </section>
  );
}
