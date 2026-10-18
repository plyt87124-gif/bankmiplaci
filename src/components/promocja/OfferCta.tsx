import { AffiliateCtaLink } from "@/components/AffiliateCtaLink";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { OfferState } from "./offerModel";

/**
 * The call to action of an offer page, in every state, for the aside and the
 * closing block:
 *
 *   live            "Przejdź do promocji" (tracked link to /out/...) and DIRECTLY
 *                   under it the compact affiliate disclosure - always, no exceptions
 *                   (a DRAFT, seen only by an admin, adds a preview note after it);
 *   ended / not promoted
 *                   a disabled button and a link to the current offers;
 *   partner link off
 *                   no bank button at all, only a sentence and a link to the list.
 *
 * Nothing here ever builds a bank URL: `href` is the internal /out/... path.
 */
export function OfferCta({
  state,
  href,
  moreOffersHref,
  moreOffersLabel,
  id,
  label = "Przejdź do promocji",
  className,
  disclosureClassName
}: {
  state: OfferState;
  /** /out/{slug}?src=... (outboundHref). */
  href: string;
  /** Where "current offers" lead (an anchor in the page, or /promocje). */
  moreOffersHref: string;
  moreOffersLabel: string;
  /** DOM id of the live link (the sticky bar watches it). */
  id?: string;
  label?: string;
  className?: string;
  disclosureClassName?: string;
}) {
  if (state.ctaLive) {
    return (
      <div className={className}>
        <AffiliateCtaLink id={id} href={href} size="lg" fullWidth>
          {label}
        </AffiliateCtaLink>
        <AffiliateDisclosure variant="compact" className={disclosureClassName} />
        {/* Admin preview of an unpublished offer: the button is shown so the page looks final, but /out/ turns a
            draft away. The note follows the disclosure, which stays directly under the button. */}
        {state.draft ? (
          <p data-draft-cta-note="" className="mt-2 text-caption text-ink-500">
            Podgląd: link /out jest nieaktywny dla wersji roboczej.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      {state.affiliateOff ? (
        <p className="text-small text-ink-700">Nie udostępniamy obecnie linku do tej oferty.</p>
      ) : (
        <Button variant="primary" size="lg" fullWidth disabled>
          {state.deadlinePassed ? "Promocja zakończona" : "Link niedostępny"}
        </Button>
      )}
      <ButtonLink href={moreOffersHref} variant="secondary" fullWidth className="mt-3">
        {moreOffersLabel}
      </ButtonLink>
    </div>
  );
}
