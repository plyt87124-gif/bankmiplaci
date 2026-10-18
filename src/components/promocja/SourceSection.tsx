import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, Flag } from "lucide-react";
import { TrustNote } from "@/components/trust/TrustNote";
import { VerifiedLine } from "@/components/trust/VerifiedLine";
import { ButtonLink } from "@/components/ui/Button";
import { formatRatingOutOf10 } from "@/lib/format";
import { describeAdditionalSource, describeFeesSource } from "@/lib/sourceLinks";
import { reportErrorHref, safeHttpUrl } from "./offerModel";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-small text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words text-ui text-ink-900">{children}</dd>
    </div>
  );
}

/** A link that leaves the site: new tab, no referrer, no ranking credit, announced to screen readers. */
function ExternalSource({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="link-inline inline-flex max-w-full items-baseline gap-1 break-words [overflow-wrap:anywhere]"
    >
      <span>{children}</span>
      <ExternalLink size={14} aria-hidden="true" className="relative top-[2px] shrink-0 self-center" />
      <span className="sr-only">(otwiera się w nowej karcie)</span>
    </a>
  );
}

/**
 * "Źródło i weryfikacja": when the data was last checked, the deadline, links
 * to the bank's own documents (regulation, additional documents, fee table),
 * the site rating with its explanation, and the two actions "Zgłoś błąd w tej
 * ofercie" (contact form with the offer's slug prefilled) and "Poleć
 * znajomemu". These are plain links to the bank's documents, not partner links.
 * The anchor id is `zrodlo`: the eligibility banner points here.
 */
export function SourceSection({
  slug,
  lastVerifiedAt,
  promoHref,
  sourceUrl,
  additionalSourceUrls,
  feesSourceUrl,
  bankWebsite,
  rating,
  ratingReason,
  ratingHref,
  verificationHref,
  now
}: {
  slug: string;
  lastVerifiedAt: Date | string | null;
  /** Internal /out/... link of the bank's promotion page; null when the offer cannot be followed. */
  promoHref: string | null;
  sourceUrl: string | null;
  additionalSourceUrls: readonly string[];
  feesSourceUrl: string | null;
  bankWebsite: string | null;
  rating: number | string | { toNumber(): number };
  ratingReason: string | null;
  ratingHref: string;
  verificationHref: string;
  now?: Date;
}) {
  const regulation = safeHttpUrl(sourceUrl);
  const extra = additionalSourceUrls.map((url) => safeHttpUrl(url)).filter((url): url is string => url !== null);
  const feesDoc = safeHttpUrl(feesSourceUrl);
  const bankSite = safeHttpUrl(bankWebsite);
  const reason = ratingReason?.trim() ?? "";

  return (
    <section id="zrodlo" aria-labelledby="zrodlo-h">
      <h2 id="zrodlo-h">Źródło i weryfikacja</h2>

      <div className="mt-5 rounded-card border border-line bg-sunken p-4 sm:p-5">
        <VerifiedLine lastVerifiedAt={lastVerifiedAt} now={now} className="text-ui text-ink-700" />
        <p className="mt-1 text-small">
          <Link href={verificationHref} className="link-inline font-medium">
            Co znaczy „Zweryfikowano”?
          </Link>
        </p>

        <ul role="list" className="mt-4 space-y-1.5 text-ui">
          <li>
            {regulation ? (
              <ExternalSource href={regulation}>Regulamin promocji</ExternalSource>
            ) : (
              <>
                Regulamin promocji: brak linku w naszych danych
                {bankSite ? (
                  <>
                    {" – "}
                    <ExternalSource href={bankSite}>strona banku</ExternalSource>
                  </>
                ) : null}
              </>
            )}
          </li>
          {feesDoc ? (
            <li>
              <ExternalSource href={feesDoc}>{describeFeesSource(feesDoc)}</ExternalSource>
            </li>
          ) : null}
          {extra.map((url, index) => {
            const label = describeAdditionalSource(url, index);
            // A plain bank page is "the promotion page": when the partner link to it is shown below, do not list it twice.
            if (promoHref && label.startsWith("strona promocyjna")) return null;
            return (
              <li key={url}>
                <ExternalSource href={url}>{label.charAt(0).toUpperCase() + label.slice(1)}</ExternalSource>
              </li>
            );
          })}
          {promoHref ? (
            <li>
              <a
                href={promoHref}
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                className="link-inline inline-flex max-w-full items-baseline gap-1"
              >
                <span>Strona promocyjna banku</span>
                <ExternalLink size={14} aria-hidden="true" className="relative top-[2px] shrink-0 self-center" />
                <span className="sr-only">(otwiera się w nowej karcie)</span>
              </a>
            </li>
          ) : null}
        </ul>

        <div className="mt-4 text-ui text-ink-700">
          Ocena serwisu <span className="num font-semibold text-ink-900">{formatRatingOutOf10(rating)}</span>
          {" – "}
          <Link href={ratingHref} className="link-inline font-medium">
            Jak liczymy?
          </Link>
          {reason ? <span className="mt-1 block text-small text-ink-700">{reason}</span> : null}
          <TrustNote kind="rating" className="mt-1" />
        </div>

        <p className="mt-4 text-small text-ink-500">Warunki mogą się zmienić po stronie banku – sprawdź aktualny regulamin.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ButtonLink href={reportErrorHref(slug)} variant="secondary">
          <Flag size={16} aria-hidden="true" className="shrink-0" />
          Zgłoś błąd w tej ofercie
        </ButtonLink>
      </div>
    </section>
  );
}
