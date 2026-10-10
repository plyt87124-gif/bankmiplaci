import Link from "next/link";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { AttributionCapture } from "@/components/AttributionCapture";
import { JsonLd } from "@/components/JsonLd";
import { PromotionCard, type PromotionCardData } from "@/components/PromotionCard";
import { TrustNote } from "@/components/trust/TrustNote";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { breadcrumbLd, endingSoonHeading, faqLd, itemListLd, promotionHeading } from "@/lib/seo";
import { EmptyOffers } from "./EmptyOffers";
import { SeoEditorial } from "./SeoEditorial";
import {
  ENDING_SOON_EARLY_END_NOTE,
  ENDING_SOON_MAX_DAYS,
  ENDING_SOON_FAQ,
  ENDING_SOON_RELATED,
  ENDING_SOON_SECTIONS,
  deadlineCaption,
  endingSoonLead,
  groupEndingSoon
} from "./endingSoon";

/**
 * /promocje/konczace-sie - current offers whose last sign-up day is within 30
 * days, grouped by 7 / 14 / 30 days (headings only for non-empty groups), with
 * a caption under each card (last day or days left, whichever the badge does not say), counted by the same
 * function as the card's deadline badge.
 *
 * The list is ordered by deadline (service: soonest first, then rating), so the
 * disclosure strip is the one for a non-"recommended" order: it does not depend
 * on the commission. An empty list is still a normal page (200, indexable):
 * message + link to /promocje, then the editorial text and the FAQ.
 */
export function EndingSoonPage({ cards, now }: { cards: readonly PromotionCardData[]; now: Date }) {
  const groups = groupEndingSoon(cards, now);
  const total = groups.reduce((sum, group) => sum + group.cards.length, 0);
  let position = 0;

  const structuredData = [
    breadcrumbLd([
      { name: "Start", path: "/" },
      { name: "Promocje", path: "/promocje" },
      { name: "Kończące się wkrótce", path: "/promocje/konczace-sie" }
    ]),
    itemListLd(
      groups.flatMap((group) => group.cards).map((card) => ({
        name: promotionHeading({ name: card.name, bankName: card.bank.name }),
        path: `/promocje/${card.slug}`
      })),
      { name: "Promocje kończące się wkrótce" }
    ),
    faqLd(ENDING_SOON_FAQ)
  ].filter((node): node is Record<string, unknown> => node !== null);

  return (
    <div className="container-page py-6 md:py-10">
      <AttributionCapture />
      <JsonLd data={structuredData} />

      <Breadcrumbs
        items={[
          { label: "Start", href: "/" },
          { label: "Promocje", href: "/promocje" },
          { label: "Kończące się wkrótce" }
        ]}
      />

      <h1 className="mt-4 max-w-3xl">{endingSoonHeading(now)}</h1>
      <p className="type-lead mt-3 max-w-2xl text-ink-700">{endingSoonLead(total)}</p>
      {total > 0 ? <p className="mt-2 max-w-2xl text-small text-ink-500">{ENDING_SOON_EARLY_END_NOTE}</p> : null}

      <div className="mt-8">
        {total > 0 ? (
          <>
            <AffiliateDisclosure variant="strip" sort="ending-soon" className="max-w-3xl" />
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={`grupa-${group.id}`} className="mt-10">
                <h2 id={`grupa-${group.id}`}>
                  {group.heading} <span className="num text-ink-500">({group.cards.length})</span>
                </h2>
                <ul role="list" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                  {group.cards.map((card) => {
                    const index = position++;
                    const caption = deadlineCaption(card.endDate, now);
                    return (
                      <li key={card.slug} className="flex min-w-0 flex-col gap-2">
                        <PromotionCard promotion={card} index={index} now={now} className="w-full flex-1" />
                        {caption ? <p className="num px-1 text-small font-medium text-ink-700">{caption}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <EmptyOffers
            headingLevel={2}
            title="Żadna promocja nie kończy się w najbliższym czasie"
            description={`Wśród aktualnych promocji nie ma teraz takiej, której termin zapisów mija w ciągu ${ENDING_SOON_MAX_DAYS} dni. Zobacz wszystkie aktualne promocje.`}
          >
            <ButtonLink href="/promocje" variant="secondary">
              Zobacz wszystkie promocje
            </ButtonLink>
            <Link href="/banki" className="link-inline inline-flex min-h-11 items-center font-medium">
              Banki z promocjami
            </Link>
          </EmptyOffers>
        )}
      </div>

      <TrustNote kind="scope" className="mt-10 max-w-[68ch]" />

      <div className="mt-16 border-t border-line pt-12 md:mt-20 md:pt-16">
        <SeoEditorial sections={ENDING_SOON_SECTIONS} faq={ENDING_SOON_FAQ} related={ENDING_SOON_RELATED} />
      </div>
    </div>
  );
}
