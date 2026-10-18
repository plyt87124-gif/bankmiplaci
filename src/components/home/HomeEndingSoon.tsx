import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { PromotionCard } from "@/components/PromotionCard";
import { pluralizePl } from "@/lib/format";
import { isRouteLive } from "@/lib/seo/routes";
import { CARD_GRID } from "./HomeFeatured";
import { ENDING_SOON_DAYS, type HomeModel } from "./homeModel";

export const ENDING_SOON_PATH = "/promocje/konczace-sie";

/**
 * "Kończą się wkrótce" (layout spec, HOME block 3): up to three offers whose
 * last sign-up day is within 14 days, the nearest deadline first. An empty
 * list renders NOTHING (no heading, no apology). The link to the full list
 * shows only while that page is live (routes.ts), so it never leads to a 404.
 *
 * The order is by deadline, not by "Polecane": the line under the intro says
 * so (the "tag" form of the disclosure, which names the order and links to
 * "Jak zarabiamy"). The cards link to the offer pages, not to banks.
 */
export function HomeEndingSoon({
  model,
  now,
  isLive = isRouteLive
}: {
  model: HomeModel | null;
  now?: Date;
  isLive?: (path: string) => boolean;
}) {
  const cards = model?.endingSoon ?? [];
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="konczace-title" className="border-t border-line">
      <div className="container-page py-12 md:py-[72px]">
        <h2 id="konczace-title">Kończą się wkrótce</h2>
        <p className="mt-3 max-w-2xl text-article text-ink-700">
          Terminy zapisów, które upływają w ciągu {ENDING_SOON_DAYS} {pluralizePl(ENDING_SOON_DAYS, "dnia", "dni", "dni")}.
          Najpierw te z najbliższym terminem.
        </p>

        <ul role="list" className={`mt-6 ${CARD_GRID}`}>
          {cards.map((card) => (
            <li key={card.slug} className="flex min-w-0">
              <PromotionCard promotion={card} priority={false} now={now} className="w-full" />
            </li>
          ))}
        </ul>

        {isLive(ENDING_SOON_PATH) ? (
          <p className="mt-8">
            <Link href={ENDING_SOON_PATH} className="link-inline inline-flex min-h-11 items-center gap-1.5 font-semibold">
              Wszystkie kończące się promocje
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
