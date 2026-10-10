import Link from "next/link";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { AttributionCapture } from "@/components/AttributionCapture";
import { JsonLd } from "@/components/JsonLd";
import type { PromotionCardData } from "@/components/PromotionCard";
import { ListingGrid } from "@/components/promocje/ListingGrid";
import { remainingText } from "@/components/promocje/listing";
import { TrustNote } from "@/components/trust/TrustNote";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { formatDatePL } from "@/lib/format";
import { breadcrumbLd, faqLd, hubHeading, isoDatePL, itemListLd, promotionHeading, type HubKind } from "@/lib/seo";
import { EmptyOffers } from "./EmptyOffers";
import { SeoEditorial } from "./SeoEditorial";
import {
  HUBS,
  HUB_CARD_LIMIT,
  HUB_FAQ,
  HUB_SECTIONS,
  hubLead,
  hubListHeading,
  hubRelatedLinks,
  latestVerification
} from "./hubs";

/**
 * /konta-osobiste-z-premia and /konta-firmowe-z-premia
 * (docs/redesign-v2/02-layout-spec.md "Nowe strony SEO", 03-content-and-seo-plan.md section E).
 *
 *   breadcrumbs -> H1 (from the SEO library) -> lead -> "Dane zaktualizowano" ->
 *   list: disclosure strip ("Polecane", the order of the list) + cards ->
 *   scope note -> editorial block -> FAQ -> "Zobacz także".
 *
 * `cards` are the public cards of ONE hub in the default "Polecane" order (see
 * hubs.ts#selectHubCards); nothing private is in them, and the page never
 * renders a partner link (a card leads to the offer page). The structured data
 * is BreadcrumbList + ItemList (the first ten visible cards) + FAQPage made
 * from the same FAQ array that is shown. Empty hub: honest message and a way
 * to /promocje, the text and FAQ stay.
 */
export function HubPage({ kind, cards }: { kind: HubKind; cards: readonly PromotionCardData[] }) {
  const hub = HUBS[kind];
  const other = HUBS[hub.other];
  const total = cards.length;
  const visible = cards.slice(0, HUB_CARD_LIMIT);
  const hidden = total - visible.length;
  const verified = latestVerification(cards);
  const faq = HUB_FAQ[kind];

  const structuredData = [
    breadcrumbLd([
      { name: "Start", path: "/" },
      { name: hub.label, path: hub.path }
    ]),
    itemListLd(
      visible.map((card) => ({
        name: promotionHeading({ name: card.name, bankName: card.bank.name }),
        path: `/promocje/${card.slug}`
      })),
      { name: hubHeading(kind) }
    ),
    faqLd(faq)
  ].filter((node): node is Record<string, unknown> => node !== null);

  return (
    <div className="container-page py-6 md:py-10">
      <AttributionCapture />
      <JsonLd data={structuredData} />

      <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: hub.label }]} />

      <h1 className="mt-4 max-w-3xl">{hubHeading(kind)}</h1>
      <p className="type-lead mt-3 max-w-2xl text-ink-700">{hubLead(kind, total)}</p>
      {verified ? (
        <p className="mt-2 text-small text-ink-500">
          Dane zaktualizowano:{" "}
          <time dateTime={isoDatePL(verified) ?? undefined}>{formatDatePL(verified, "numeric")}</time>
        </p>
      ) : null}

      <section aria-labelledby="lista-promocji" className="mt-8">
        <h2 id="lista-promocji">{total > 0 ? hubListHeading(total) : "Aktualne promocje"}</h2>
        {total > 0 ? (
          <>
            <AffiliateDisclosure variant="strip" sort="recommended" className="mt-4 max-w-3xl" />
            <div className="mt-6">
              <ListingGrid cards={visible} moreHref={null} remaining={0} />
            </div>
            {hidden > 0 ? (
              <p className="mt-6 text-ui text-ink-700">
                {remainingText(hidden)} –{" "}
                <Link href="/promocje" className="link-inline font-medium">
                  zobacz pełną listę z filtrami i sortowaniem
                </Link>
                .
              </p>
            ) : null}
          </>
        ) : (
          <EmptyOffers
            className="mt-4"
            title={kind === "personal" ? "Brak aktualnych promocji na konta osobiste" : "Brak aktualnych promocji na konta firmowe"}
            description="Nie mamy teraz ofert tego rodzaju do pokazania. Zajrzyj tu później albo zobacz wszystkie aktualne promocje."
          >
            <ButtonLink href="/promocje" variant="secondary">
              Zobacz wszystkie promocje
            </ButtonLink>
            <Link href={other.path} className="link-inline inline-flex min-h-11 items-center font-medium">
              {other.label}
            </Link>
          </EmptyOffers>
        )}
      </section>

      <TrustNote kind="scope" className="mt-10 max-w-[68ch]" />

      <div className="mt-16 border-t border-line pt-12 md:mt-20 md:pt-16">
        <SeoEditorial sections={HUB_SECTIONS[kind]} faq={faq} related={hubRelatedLinks(kind)} />
      </div>
    </div>
  );
}
