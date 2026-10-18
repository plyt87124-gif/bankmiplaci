import { ListChecks, ShieldCheck } from "lucide-react";
import { PromotionCard } from "@/components/PromotionCard";
import { ButtonLink } from "@/components/ui/Button";
import { CountUp } from "@/components/motion/CountUp";
import { LATEST_VERIFICATION_LABEL } from "@/lib/disclosureCopy";
import { formatDatePL, pluralizePl } from "@/lib/format";
import { isoDatePL } from "@/lib/seo/dates";
import { HeroSpotlight } from "./HeroSpotlight";
import { HomeSegmentControl } from "./HomeSegment";
import { HOME_H1, HOME_LEAD, HOME_RATING_HREF } from "./homeContent";
import type { HomeModel } from "./homeModel";

/**
 * Hero (layout spec, HOME block 1): no illustration, no animation of its own.
 * The kicker, H1 and lead are plain server HTML (the LCP is text; nothing in
 * here is revealed on scroll). The only motion is the count-up of the offer
 * counter, an aggregate and therefore allowed. The status dot is static.
 *
 * `model` is null when the database could not be read: the kicker and the
 * counter then simply disappear, nothing is made up.
 */
export function HomeHero({
  model,
  now,
}: {
  model: HomeModel | null;
  now?: Date;
}) {
  const total = model?.total ?? 0;
  const spotlight = model?.spotlight ?? [];
  const verified = model?.latestVerifiedAt ?? null;
  const verifiedText = verified ? formatDatePL(verified, "short") : "";
  const verifiedIso = verified ? isoDatePL(verified) : null;

  return (
    <section
      aria-labelledby="home-title"
      className="border-b border-line bg-surface"
    >
      <div className="container-page grid items-center gap-10 py-14 md:py-[88px] lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-12">
        <div className="min-w-0">
          {verifiedText ? (
            <p className="type-label flex items-center gap-2 text-ink-500">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-teal-600"
              />
              <span>
                {LATEST_VERIFICATION_LABEL}:{" "}
                <time dateTime={verifiedIso ?? undefined}>{verifiedText}</time>
              </span>
            </p>
          ) : null}

          <h1
            id="home-title"
            className={verifiedText ? "mt-4 max-w-3xl" : "max-w-3xl"}
          >
            {HOME_H1}
          </h1>
          <p className="type-lead mt-4 max-w-2xl text-ink-700">{HOME_LEAD}</p>

          <div className="mt-8 flex flex-col items-start gap-6">
            <HomeSegmentControl />
            <div className="flex flex-wrap items-center gap-3">
              {/* Always the clean, canonical /promocje: the biggest internal link of the site must not point at a noindex filter variant. The segment choice only drives "Zobacz wszystkie (N)" below the list. */}
              <ButtonLink href="/promocje" size="lg">
                Zobacz promocje
              </ButtonLink>
              <ButtonLink href="/jak-to-dziala" variant="ghost" size="lg">
                Jak to działa
              </ButtonLink>
            </div>
          </div>

          {verifiedText ? (
            <p className="mt-10 flex items-start gap-2.5 border-t border-line pt-6 text-small text-ink-700">
              <ShieldCheck
                size={20}
                aria-hidden="true"
                className="mt-px shrink-0 text-ink-500"
              />
              <span>Przy każdej ofercie pokazujemy datę weryfikacji</span>
            </p>
          ) : null}
        </div>

        {spotlight.length > 0 ? (
          <HeroSpotlight
            header={
              total > 0 ? (
                <p className="flex items-center gap-2.5 text-ui text-ink-700">
                  <ListChecks
                    size={20}
                    aria-hidden="true"
                    className="shrink-0 text-ink-500"
                  />
                  <span>
                    <CountUp
                      value={total}
                      className="font-semibold text-ink-900"
                    />{" "}
                    {pluralizePl(
                      total,
                      "aktualna promocja",
                      "aktualne promocje",
                      "aktualnych promocji",
                    )}
                  </span>
                </p>
              ) : null
            }
            labels={spotlight.map((card) => `${card.bank.name}: ${card.name}`)}
            slides={spotlight.map((card, index) => (
              <PromotionCard
                key={card.slug}
                promotion={card}
                index={index}
                priority={index === 0}
                now={now}
                className="w-full"
              />
            ))}
          />
        ) : null}
      </div>
    </section>
  );
}
