import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { PromotionCard, type PromotionCardData } from "@/components/PromotionCard";
import { remainingText } from "@/components/promocje/listing";

/**
 * The offer grid of /promocje: 1 column below 640 px, 2 up to 1023 px, 3 from
 * 1024 px - and back to 2 from xl (1280 px), where the 16 rem filter panel
 * takes its share of the 70 rem container and three columns of about 260 px
 * would squeeze the card's rows. Cards are list items of one <ul>; the first ones load their logo
 * with priority. "Pokaż więcej" is a plain link to `?strona=N` (it works
 * without JavaScript, is crawlable and is noindex through the page's
 * metadata) - the next page shows the same cards plus the next 24.
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
      <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 xl:grid-cols-2">
        {cards.map((card, index) => (
          <li key={card.slug} className="flex min-w-0">
            <PromotionCard promotion={card} index={index} className="w-full" />
          </li>
        ))}
      </ul>

      {moreHref ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Link href={moreHref} scroll={false} className={buttonClasses({ variant: "secondary", size: "md" })}>
            Pokaż więcej
          </Link>
          <p className="text-small text-ink-500">{remainingText(remaining)}</p>
        </div>
      ) : null}
    </>
  );
}
