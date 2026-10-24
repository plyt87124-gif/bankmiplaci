import Link from "next/link";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ViewerFilterNote } from "@/components/ViewerFilterNote";
import { AttributionCapture } from "@/components/AttributionCapture";
import { JsonLd } from "@/components/JsonLd";
import type { PromotionCardData } from "@/components/PromotionCard";
import { ListingGrid } from "@/components/promocje/ListingGrid";
import { TrustNote } from "@/components/trust/TrustNote";
import { BankLogo } from "@/components/ui/BankLogo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { formatDatePL } from "@/lib/format";
import { bankHeading, breadcrumbLd, faqLd, isoDatePL, itemListLd, promotionHeading } from "@/lib/seo";
import {
  accountTypeLabel,
  activeCountText,
  bankDescriptionParagraphs,
  bankFaq,
  bankSummary,
  endedOfferHref,
  endedOffersNote,
  endedOffersOf,
  type BankOfferRow,
  type BankRecord
} from "./banks";
import { EmptyOffers } from "./EmptyOffers";
import { SeoEditorial } from "./SeoEditorial";
import { COMMON_RELATED_LINKS } from "./shared";

/**
 * /banki/[slug] - the permanent page of one bank (200 after its offers end).
 *
 *   breadcrumbs -> logo + H1 -> lead -> a summary of the current offers made of the
 *   data (kinds of accounts, bonus and deadline ranges, last check) (+ Bank.description when it is not blank) ->
 *   "Aktualne promocje": disclosure strip + cards, or "Brak aktualnych promocji" ->
 *   "Zakończone promocje banku" (facts from the database: name, type, last day;
 *   a link only while the offer page is indexable) -> FAQ made of the bank's
 *   data -> scope note -> "Zobacz także".
 *
 * `cards` are the bank's current offers as public cards in the default
 * "Polecane" order, `offers` the slim rows of all its non-draft offers. No
 * partner link and no commission is rendered. Structured data: BreadcrumbList +
 * ItemList (current offers) + FAQPage when there is a FAQ.
 */
export function BankPage({
  bank,
  cards,
  offers,
  now
}: {
  bank: BankRecord;
  cards: readonly PromotionCardData[];
  offers: readonly BankOfferRow[];
  now: Date;
}) {
  const ended = endedOffersOf(offers, now);
  const endedNote = endedOffersNote(ended);
  const faq = bankFaq(bank.name, cards);
  const summary = bankSummary(cards);
  const about = bankDescriptionParagraphs(bank.description);
  const path = `/banki/${bank.slug}`;

  const structuredData = [
    breadcrumbLd([
      { name: "Start", path: "/" },
      { name: "Banki", path: "/banki" },
      { name: bank.name, path }
    ]),
    itemListLd(
      cards.map((card) => ({
        name: promotionHeading({ name: card.name, bankName: card.bank.name }),
        path: `/promocje/${card.slug}`
      })),
      { name: `Aktualne promocje: ${bank.name}` }
    ),
    faqLd(faq)
  ].filter((node): node is Record<string, unknown> => node !== null);

  return (
    <div className="container-page py-6 md:py-10">
      <AttributionCapture />
      <JsonLd data={structuredData} />

      <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Banki", href: "/banki" }, { label: bank.name }]} />

      <header className="mt-4">
        <BankLogo name={bank.name} logoUrl={bank.logoUrl} size="lg" priority />
        <h1 className="mt-4 max-w-3xl">{bankHeading(bank.name)}</h1>
        <p className="type-lead mt-3 max-w-2xl text-ink-700">
          {cards.length > 0
            ? `${bank.name}: ${activeCountText(cards.length)}. Sprawdź kwotę premii, trudność, koszt konta i termin zapisów każdej z nich.`
            : ended.total > 0
              ? `${bank.name}: brak aktualnych promocji. Poniżej znajdziesz zakończone promocje tego banku.`
              : `${bank.name}: brak aktualnych promocji. Sprawdź promocje innych banków.`}
        </p>
        {summary ? <p className="mt-3 max-w-2xl text-ui text-ink-700">{summary}</p> : null}
        {about.length > 0 ? (
          <div className="mt-4 max-w-2xl space-y-3 text-ui text-ink-700">
            {about.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        ) : null}
      </header>

      <section aria-labelledby="aktualne-promocje" className="mt-8">
        <h2 id="aktualne-promocje">{cards.length > 0 ? `Aktualne promocje (${cards.length})` : "Aktualne promocje"}</h2>
        {cards.length > 0 ? (
          <>
            <AffiliateDisclosure variant="strip" sort="recommended" className="mt-4 max-w-3xl" />
            <ViewerFilterNote />
            <div className="mt-6">
              <ListingGrid cards={cards} moreHref={null} remaining={0} />
            </div>
          </>
        ) : (
          <EmptyOffers
            className="mt-4"
            title="Brak aktualnych promocji"
            description="Nie mamy teraz promocji, z których można skorzystać w tym banku. Strona banku zostaje w serwisie, więc jeśli pojawi się nowa oferta, zobaczysz ją tutaj."
          >
            <ButtonLink href="/promocje" variant="secondary">
              Zobacz aktualne promocje innych banków
            </ButtonLink>
            <Link href="/banki" className="link-inline inline-flex min-h-11 items-center font-medium">
              Wszystkie banki
            </Link>
          </EmptyOffers>
        )}
      </section>

      {ended.total > 0 ? (
        <section aria-labelledby="zakonczone-promocje" className="mt-12">
          <h2 id="zakonczone-promocje">Zakończone promocje banku</h2>
          <p className="mt-2 max-w-prose text-ui text-ink-700">
            Termin zapisów na te promocje minął. Zostawiamy je jako informację o poprzednich ofertach banku.
          </p>
          <ul role="list" className="mt-4 max-w-3xl border-t border-line">
            {ended.shown.map((row) => {
              const href = endedOfferHref(row, now);
              const type = accountTypeLabel(row.accountType);
              const dateText = formatDatePL(row.endDate, "numeric");
              return (
                <li key={row.slug} className="border-b border-line py-2">
                  {/* Name on its own line (a long name wraps cleanly), the facts under it. */}
                  {href ? (
                    <Link href={href} className="link-inline inline-block py-2 font-semibold [overflow-wrap:anywhere]">
                      {row.name}
                    </Link>
                  ) : (
                    <span className="inline-block py-2 font-semibold text-ink-900 [overflow-wrap:anywhere]">{row.name}</span>
                  )}
                  <p className="pb-1 text-small text-ink-700">
                    {type ? `${type} · ` : null}
                    Zakończona <time dateTime={isoDatePL(row.endDate) ?? undefined}>{dateText}</time>
                  </p>
                </li>
              );
            })}
          </ul>
          {endedNote ? <p className="mt-3 text-small text-ink-500">{endedNote}</p> : null}
        </section>
      ) : null}


      <div className="mt-16 border-t border-line pt-12 md:mt-20 md:pt-16">
        <SeoEditorial
          faq={faq}
          faqHeading={`Najczęstsze pytania o promocje: ${bank.name}`}
          related={[
            { href: "/banki", label: "Wszystkie banki" },
            { href: "/promocje", label: "Wszystkie aktualne promocje" },
            ...COMMON_RELATED_LINKS
          ]}
        />
      </div>
    </div>
  );
}
