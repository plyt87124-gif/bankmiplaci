import { LoadMoreLink } from "@/components/promocje/LoadMoreLink";
import { PromotionCard, type PromotionCardData } from "@/components/PromotionCard";
import { remainingText } from "@/components/promocje/listing";

/**
 * The offer grid of /promocje: 1 column below 640 px, 2 up to 1023 px, 3 from
 * 1024 px (docs/redesign-v2/02-layout-spec.md). The number of columns never
 * drops as the screen gets wider: the filters live in the toolbar and in a
 * sheet, not in a side panel. Cards are list items of one <ul>; the first ones
 * load their logo with priority. "Pokaż więcej" is a plain link to `?strona=N`
 * (it works without JavaScript, is crawlable and is noindex through the page's
 * metadata) - the next page shows the same cards plus the next 24. With
 * JavaScript it shows a loading state (LoadMoreLink).
 */
export function ListingGrid({
  cards,
  moreHref,
  remaining
}: {
  cards: readonly PromotionCardData[];
  /** Link to the next page, null when everything is visible. */
  moreHref: string | null;
  remaining: number;
}) {
  return (
    <>
      <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {cards.map((card, index) => (
          <li key={card.slug} className="flex min-w-0">
            <PromotionCard promotion={card} index={index} className="w-full" />
          </li>
        ))}
      </ul>

      {moreHref ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <LoadMoreLink href={moreHref} />
          <p className="text-small text-ink-500">{remainingText(remaining)}</p>
        </div>
      ) : null}
    </>
  );
}
