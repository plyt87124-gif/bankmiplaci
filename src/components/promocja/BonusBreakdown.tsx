import { ChevronDown } from "lucide-react";
import { Money } from "@/components/ui/Money";
import { formatDatePL } from "@/lib/format";
import { isBonusPartOpen } from "@/lib/promotionAvailability";
import { labelWithoutAmount } from "./offerModel";

export interface BonusPartView {
  id: string;
  label: string;
  amountCents: number;
  availableUntil: Date | string | null;
}

/** Splits the parts into those a NEW participant can still join and those whose own window has closed. */
export function splitBonusParts<T extends { availableUntil?: Date | string | null }>(
  parts: readonly T[],
  now: Date = new Date()
): { open: T[]; closed: T[] } {
  return {
    open: parts.filter((p) => isBonusPartOpen(p, now)),
    closed: parts.filter((p) => !isBonusPartOpen(p, now))
  };
}

/**
 * "Ile dostaniesz: składniki premii". Shown only when the premium is made of
 * more than one part that is still open to new participants (one part would
 * repeat the headline amount). Native <details>: no JS, the full text is
 * always in the HTML. Parts whose own sign-up window has closed (e.g. a bonus
 * that ended before the main offer) are listed separately and are NEVER summed
 * into the amount: they stay in the data for people who joined earlier.
 *
 * A label stored with its own amount ("… — 200 zł") is shown without it: the
 * amount has a column of its own (labelWithoutAmount).
 */
export function BonusBreakdown({
  openParts,
  closedParts,
  maxBonusCents
}: {
  openParts: readonly BonusPartView[];
  closedParts: readonly BonusPartView[];
  maxBonusCents: number;
}) {
  const showOpen = openParts.length > 1;
  if (!showOpen && closedParts.length === 0) return null;

  const sum = openParts.reduce((total, part) => total + part.amountCents, 0);

  return (
    <section aria-labelledby="skladniki-h">
      {showOpen ? (
        <>
          <h2 id="skladniki-h">Ile dostaniesz: składniki premii</h2>
          <details open className="accordion mt-5 rounded-card border border-line bg-surface">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-4 py-3 text-ui font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">Z czego składa się premia ({openParts.length} części)</span>
              <ChevronDown size={20} aria-hidden="true" className="acc-chevron shrink-0 text-ink-500" />
            </summary>
            <ul role="list" className="divide-y divide-line border-t border-line">
              {openParts.map((part) => (
                <li key={part.id} className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
                  <span className="min-w-0 break-words text-ui text-ink-700">{labelWithoutAmount(part.label, part.amountCents)}</span>
                  <Money cents={part.amountCents} className="shrink-0 text-ui text-ink-900" />
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
                <span className="text-ui font-semibold text-ink-900">Premia maksymalna</span>
                <Money cents={sum || maxBonusCents} className="shrink-0 text-ui text-ink-900" />
              </li>
            </ul>
            <p className="border-t border-line px-4 py-3 text-small text-ink-500 sm:px-5">
              Premia maksymalna nie jest gwarantowana – otrzymasz ją tylko po spełnieniu wszystkich warunków
              cząstkowych opisanych wyżej.
            </p>
          </details>
        </>
      ) : (
        <h2 id="skladniki-h" className="sr-only">
          Części premii
        </h2>
      )}

      {closedParts.length > 0 ? (
        <div className={showOpen ? "mt-4 rounded-card border border-line bg-sunken p-4 sm:p-5" : "rounded-card border border-line bg-sunken p-4 sm:p-5"}>
          <h3 className="text-h4">Zakończone dla nowych uczestników</h3>
          <p className="mt-1 text-small text-ink-700">
            Zapisy do tych części oferty już się zakończyły. Nie są wliczone w kwotę premii; informacja przydatna
            tylko osobom, które przystąpiły do nich wcześniej.
          </p>
          <ul role="list" className="mt-3 divide-y divide-line text-small text-ink-700">
            {closedParts.map((part) => {
              const until = part.availableUntil ? formatDatePL(part.availableUntil) : "";
              return (
                <li key={part.id} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="min-w-0 break-words">
                    {labelWithoutAmount(part.label, part.amountCents)}
                    {until ? <> (zapisy do {until})</> : null}
                  </span>
                  <Money cents={part.amountCents} className="shrink-0" />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
