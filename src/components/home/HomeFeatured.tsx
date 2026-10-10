import Link from "next/link";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { PromotionCard } from "@/components/PromotionCard";
import { TrustNote } from "@/components/trust/TrustNote";
import { ButtonLink } from "@/components/ui/Button";
import { HomeSeeAllLink, HomeSegmentPanels, type HomePanel } from "./HomeSegment";
import type { HomeModel } from "./homeModel";

/** The 1 / 2 / 3 column grid of the offer lists (same as /promocje). */
export const CARD_GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6";

/**
 * "Polecane promocje" (layout spec, HOME block 2). The heading says "Polecane",
 * never a superlative; the disclosure strip sits DIRECTLY under it, with the
 * wording from lib/disclosureCopy.ts (the order takes the partner remuneration
 * into account, the rating does not). Below it, the first three offers of the
 * selected segment in "Polecane" order, then "Zobacz wszystkie (N)" and the
 * standing note about the scope of the comparison.
 *
 * The cards of every segment are rendered here, on the server, and handed to
 * the client island as ready nodes; only the selected one is visible.
 */
export function HomeFeatured({ model, now }: { model: HomeModel | null; now?: Date }) {
  const panels: HomePanel[] = (model?.segments ?? []).map((segment) => ({
    value: segment.value,
    content: (
      <ul role="list" className={CARD_GRID}>
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
      </ul>
    )
  }));
  const hasOffers = panels.length > 0;

  return (
    <section aria-labelledby="polecane-title" className="container-page py-12 md:py-24">
      <h2 id="polecane-title">Polecane promocje</h2>

      {hasOffers ? (
        <>
          <AffiliateDisclosure variant="strip" sort="recommended" className="mt-4 max-w-3xl" />
          <HomeSegmentPanels panels={panels} className="mt-6" />
          <div className="mt-8">
            <HomeSeeAllLink />
          </div>
          <TrustNote kind="scope" className="mt-6 max-w-[68ch]" />
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
