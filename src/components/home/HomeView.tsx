import { JsonLd } from "@/components/JsonLd";
import { Reveal } from "@/components/motion/Reveal";
import { faqLd, organizationLd, websiteLd } from "@/lib/seo";
import { HomeEffort } from "./HomeEffort";
import { HomeEndingSoon } from "./HomeEndingSoon";
import { HomeFaq } from "./HomeFaq";
import { HomeFeatured } from "./HomeFeatured";
import { HomeHero } from "./HomeHero";
import { HomeQuizBand } from "./HomeQuizBand";
import { HomeSegmentProvider } from "./HomeSegment";
import { HomeTrust } from "./HomeTrust";
import { homeFaqItems, liveHomeHubs } from "./homeContent";
import type { HomeModel } from "./homeModel";

/**
 * The home page in the order of the layout spec (docs/redesign-v2/02-layout-spec.md):
 *   1 hero (+ segment, counter)   2 Polecane promocje   3 Kończą się wkrótce
 *   4 Ile wysiłku wymaga promocja?   5 quiz band   6 Dlaczego możesz nam ufać
 *   7 FAQ shortcut + hubs
 * The hero and the featured list share the segment state (HomeSegmentProvider);
 * everything below the featured list scrolls in with Reveal (never the hero or
 * the offers the visitor came for). `model` is null when the database could not
 * be read: the static blocks still render.
 *
 * JSON-LD: Organization and WebSite (the `@id`s that the offer pages point to
 * with `isPartOf`) and the FAQPage of the shortcut, built from the very items
 * the accordion shows. No ItemList, no rating of any kind.
 *
 * `now` and `hubs` are injectable for tests; pages leave them out.
 */
export function HomeView({
  model,
  now,
  hubs = liveHomeHubs()
}: {
  model: HomeModel | null;
  now?: Date;
  hubs?: ReturnType<typeof liveHomeHubs>;
}) {
  const faqItems = homeFaqItems();
  const structuredData = [organizationLd(), websiteLd(), faqLd(faqItems)].filter(
    (node): node is Record<string, unknown> => node !== null
  );
  const segmentOptions = (model?.segments ?? []).map((segment) => ({
    value: segment.value,
    label: segment.label,
    href: segment.href,
    count: segment.count
  }));

  return (
    <>
      <JsonLd data={structuredData} />

      <HomeSegmentProvider options={segmentOptions} initial={model?.defaultSegment ?? null}>
        <HomeHero model={model} />
        <HomeFeatured model={model} now={now} />
      </HomeSegmentProvider>

      {/* Blocks without content are not rendered at all (no empty wrapper, no observer). */}
      {model && model.endingSoon.length > 0 ? (
        <Reveal>
          <HomeEndingSoon model={model} now={now} />
        </Reveal>
      ) : null}
      {model && model.effortExamples.length > 0 ? (
        <Reveal>
          <HomeEffort model={model} now={now} />
        </Reveal>
      ) : null}
      <Reveal>
        <HomeQuizBand />
      </Reveal>
      <Reveal>
        <HomeTrust />
      </Reveal>
      <Reveal>
        <HomeFaq items={faqItems} hubs={hubs} />
      </Reveal>
    </>
  );
}
