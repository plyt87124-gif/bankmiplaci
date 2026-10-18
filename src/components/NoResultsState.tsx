import Link from "next/link";
import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { PromotionCard, type PromotionCardData } from "@/components/PromotionCard";
import { pluralizePl } from "@/lib/format";

/** One way out of an empty result: "remove this filter and N offers appear". */
export interface Relaxation {
  /** What is removed, e.g. "Trudność: Trudna". */
  label: string;
  /** The listing without that filter. */
  href: string;
  /** Offers that match once it is removed. */
  count: number;
}

export interface NoResultsStateProps {
  /** The search text, when there is one (it is quoted in the heading). */
  query?: string;
  /** Whether any filter is active (otherwise the list is simply empty). */
  hasFilters: boolean;
  /** Single-filter relaxations that give at least one result, best first. */
  relaxations?: readonly Relaxation[];
  /** The listing with every filter removed (the sort stays). */
  clearHref?: string;
  /** A few offers to look at instead, and what they are. */
  suggestions?: { caption: string; cards: readonly PromotionCardData[] };
  className?: string;
}

/**
 * Empty result of /promocje: says what is wrong, offers "Wyczyść filtry" and
 * the single filters whose removal brings offers back, and shows up to three
 * of those offers so the page is never a dead end. With no filter active the
 * list is just empty (no offers in the database yet): honest message, nothing
 * to loosen. Server component.
 */
export function NoResultsState({
  query,
  hasFilters,
  relaxations = [],
  clearHref = "/promocje",
  suggestions,
  className
}: NoResultsStateProps) {
  const heading = !hasFilters
    ? "Obecnie nie mamy aktualnych promocji do pokazania"
    : query
      ? `Brak promocji dla „${query}” przy wybranych filtrach`
      : "Brak promocji spełniających wybrane filtry";

  return (
    <div className={className} data-empty-state="true">
      <div className="rounded-card border border-dashed border-line-strong bg-surface p-6 text-center sm:p-10">
        <SearchX size={32} aria-hidden="true" className="mx-auto text-ink-500" />
        <h3 className="mt-3 text-h4 text-ink-900">{heading}</h3>
        <p className="mx-auto mt-1 max-w-prose text-small text-ink-700">
          {hasFilters
            ? "Poluzuj filtr albo wyczyść wszystkie – poniżej pokazujemy, co się zmieni."
            : "Zajrzyj tu za jakiś czas albo sprawdź poradniki, jak działają promocje bankowe."}
        </p>

        {hasFilters && relaxations.length > 0 ? (
          <ul role="list" className="mx-auto mt-5 flex max-w-xl flex-col items-stretch gap-2">
            {relaxations.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-field border border-line-strong bg-surface px-4 py-2 text-left text-small hover:bg-sunken"
                >
                  <span className="font-semibold text-ink-900">Usuń filtr: {item.label}</span>
                  <span className="num shrink-0 text-ink-700">
                    {item.count} {pluralizePl(item.count, "promocja", "promocje", "promocji")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {hasFilters ? (
            <ButtonLink href={clearHref} variant="primary" scroll={false}>
              Wyczyść filtry
            </ButtonLink>
          ) : (
            <ButtonLink href="/blog" variant="secondary">
              Poradniki
            </ButtonLink>
          )}
        </div>
      </div>

      {suggestions && suggestions.cards.length > 0 ? (
        <section aria-label={suggestions.caption} className="mt-8">
          <p className="text-small font-semibold text-ink-900">{suggestions.caption}</p>
          <ul role="list" className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {suggestions.cards.map((card) => (
              <li key={card.slug} className="flex">
                <PromotionCard promotion={card} headingLevel={4} className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
