import Link from "next/link";
import { PromotionCard } from "@/components/PromotionCard";
import { EffortMeter } from "@/components/ui/EffortMeter";
import { HOME_DIFFICULTY_HREF } from "./homeContent";
import type { HomeModel } from "./homeModel";

const LEVELS = [1, 2, 3, 4] as const;

/**
 * "Ile wysiłku wymaga promocja?" (layout spec, HOME block 4): one sentence, the
 * four-step legend of the effort meter and the easiest and the hardest real
 * offer of the pool (one card when the pool has a single level - never an
 * invented one). The meter is neutral (ink, no traffic-light colours): a hard
 * promotion is not an error. Without any offer there is nothing to show, so
 * the block is not rendered.
 */
export function HomeEffort({ model, now }: { model: HomeModel | null; now?: Date }) {
  const examples = model?.effortExamples ?? [];
  if (examples.length === 0) return null;

  return (
    <section aria-labelledby="wysilek-title" className="border-t border-line">
      <div className="container-page py-12 md:py-[72px]">
        <div className="grid gap-8 lg:grid-cols-3 lg:items-start lg:gap-6">
          <div className="lg:pr-6">
            <h2 id="wysilek-title">Ile wysiłku wymaga promocja?</h2>
            <p className="mt-3 text-article text-ink-700">
              Sama premia nie mówi, ile trzeba zrobić, żeby ją dostać. Dlatego przy każdej promocji pokazujemy
              trudność, którą ustalamy m.in. po wymaganych płatnościach kartą i progach wpływów na konto.
            </p>
            <ul role="list" aria-label="Skala trudności" className="mt-5 flex flex-col gap-3">
              {LEVELS.map((level) => (
                <li key={level}>
                  <EffortMeter level={level} />
                </li>
              ))}
            </ul>
            <p className="mt-5 text-small">
              <Link href={HOME_DIFFICULTY_HREF} className="link-inline inline-flex min-h-11 items-center font-medium">
                Jak ustalamy trudność
              </Link>
            </p>
          </div>

          <div className="lg:col-span-2">
            <p className="type-label mb-3 text-ink-500">
              {examples.length > 1 ? "Przykłady z aktualnej oferty" : "Przykład z aktualnej oferty"}
            </p>
            <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:gap-6">
              {examples.map((card) => (
                <li key={card.slug} className="flex min-w-0">
                  <PromotionCard promotion={card} priority={false} now={now} className="w-full" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
