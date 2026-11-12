import Link from "next/link";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ViewerFilterNote } from "@/components/ViewerFilterNote";
import { PromotionCard } from "@/components/PromotionCard";
import { TrustNote } from "@/components/trust/TrustNote";
import { ButtonLink } from "@/components/ui/Button";
import { CardRail } from "@/components/ui/CardRail";
import { HomeSeeAllLink, HomeSegmentPanels, type HomePanel } from "./HomeSegment";
import type { HomeModel } from "./homeModel";

/**
 * "Promocje z najwyższą oceną" (layout spec, HOME block 2). Owner, 2026-11-11: the home page shows the
 * offers with the highest site rating (scale 0-10, the "Ocena serwisu" on every card), not
 * the "Polecane" order, which is only a sort option on the /promocje list. The heading
 * ("Promocje z najwyższą oceną", owner's wording, without "serwisu") is a statement about a
 * defined number: the "Ocena serwisu" printed on every card (explained at /metodologia), not
 * a bare "best". The disclosure strip (switched off by the
 * owner, SHOW_AFFILIATE_NOTICES) would sit DIRECTLY under it, with the wording for a
 * non-"Polecane" order. Below it, the first three offers of the selected segment, highest
 * rating first, then "Zobacz wszystkie (N)" and the standing note about the scope of the
 * comparison.
 *
 * The cards of every segment are rendered here, on the server, and handed to
 * the client island as ready nodes; only the selected one is visible. On a
 * phone the cards are a swipeable row with the neighbours peeking out
 * (ui/CardRail.tsx); from `sm` up they are the usual 2 / 3 column grid.
 */
export function HomeFeatured({ model, now }: { model: HomeModel | null; now?: Date }) {
  const panels: HomePanel[] = (model?.segments ?? []).map((segment) => ({
    value: segment.value,
    content: (
      <CardRail>
        {segment.featured.map((card, index) => (
          <li key={card.slug} className="flex min-w-0">
            {/* Only the visible segment preloads its logos (the first cards are above the fold on large screens). */}
            <PromotionCard
              promotion={card}
              index={index}
              priority={segment.value === model?.defaultSegment ? undefined : false}
              now={now}
              className="w-full"
            />
          </li>
        ))}
      </CardRail>
    )
  }));
  const hasOffers = panels.length > 0;

  return (
    <section aria-labelledby="najwyzsza-ocena-title" className="container-page py-12 md:py-24">
      <h2 id="najwyzsza-ocena-title">Promocje z najwyższą oceną</h2>

      {hasOffers ? (
        <>
          <AffiliateDisclosure variant="strip" sort="top-rated" className="mt-4 max-w-3xl" />
          <HomeSegmentPanels panels={panels} className="mt-6" />
          <ViewerFilterNote />
          <div className="mt-8">
            <HomeSeeAllLink />
          </div>
        </>
      ) : (
        <div className="mt-6 max-w-2xl rounded-card border border-line bg-surface p-5 sm:p-6">
          {model === null ? (
            <>
              <p className="font-semibold text-ink-900">Nie udało się teraz wczytać promocji.</p>
              <p className="mt-1 text-ink-700">Odśwież stronę za chwilę albo spróbuj otworzyć pełną listę.</p>
            </>
          ) : model.total > 0 ? (
            <p className="text-ink-700">
              Aktualne promocje znajdziesz na pełnej liście, z filtrami i sortowaniem.
            </p>
          ) : (
            <>
              <p className="font-semibold text-ink-900">Nie mamy teraz aktualnych promocji do pokazania.</p>
              <p className="mt-1 text-ink-700">
                Zajrzyj tu ponownie za jakiś czas.{" "}
                <Link href="/jak-to-dziala" className="link-inline font-medium">
                  Jak to działa
                </Link>
              </p>
            </>
          )}
          <ButtonLink href="/promocje" variant="secondary" className="mt-4">
            Przejdź do listy promocji
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
