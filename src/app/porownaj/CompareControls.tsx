"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Segment } from "@/components/ui/Segment";
import { Button } from "@/components/ui/Button";
import { pluralizePl } from "@/lib/format";
import { COMPARE_MAX, SEGMENT_LABEL, compareUrl, type CompareSegment } from "./compareModel";

export interface CompareOption {
  slug: string;
  bank: string;
  name: string;
}

/** "Wybrano 4 z maks. 4 ofert (dostępnych: 16)" - every number comes from the data. */
export function selectionSummary(chosen: number, max: number, available: number): string {
  return `Wybrano ${chosen} z maks. ${max} ofert (dostępnych: ${available})`;
}

/**
 * Segment (Osobiste | Firmowe) and the offer picker of /porownaj. The state
 * lives in the URL (`?typ=`, `?oferty=`), the page is rendered on the server:
 * every change is a `router.replace` (no history entries, no scroll jump). The
 * picker is a native <details> - one pattern for every width, the checkboxes
 * stay reachable by keyboard and screen readers.
 */
export function CompareControls({
  segment,
  counts,
  options,
  selected,
  isDefault
}: {
  segment: CompareSegment;
  counts: Record<CompareSegment, number>;
  /** Every offer of the segment, in the table's order. */
  options: CompareOption[];
  /** Slugs currently compared. */
  selected: string[];
  /** True while the selection is the automatic "top of the ranking". */
  isDefault: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string[]>(selected);

  // The server answer is the truth: adopt it when it arrives (or when a link such as the quiz's changes it).
  const selectedKey = selected.join(",");
  useEffect(() => {
    setChosen((current) => (current.join(",") === selectedKey ? current : selectedKey ? selectedKey.split(",") : []));
  }, [selectedKey]);

  function go(url: string) {
    startTransition(() => router.replace(url, { scroll: false }));
  }

  function toggle(slug: string, checked: boolean) {
    const next = checked ? [...chosen, slug] : chosen.filter((s) => s !== slug);
    if (next.length < 1 || next.length > COMPARE_MAX) return;
    // Keep the table's order, not the order of clicking.
    const ordered = options.map((o) => o.slug).filter((s) => next.includes(s));
    setChosen(ordered);
    go(compareUrl(segment, ordered));
  }

  const full = chosen.length >= COMPARE_MAX;
  const onlyOne = chosen.length <= 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Segment<CompareSegment>
          label="Rodzaj konta"
          value={segment}
          onChange={(next) => go(compareUrl(next, null))}
          options={[
            { value: "PERSONAL", label: SEGMENT_LABEL.PERSONAL, count: counts.PERSONAL },
            { value: "BUSINESS", label: SEGMENT_LABEL.BUSINESS, count: counts.BUSINESS }
          ]}
        />
        <p role="status" aria-live="polite" className="min-h-[1.375rem] text-small text-ink-500">
          {pending ? "Aktualizuję tabelę…" : ""}
        </p>
      </div>

      <details className="rounded-card border border-line bg-surface">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-ui font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
          <span>
            Wybierz oferty do porównania
            <span className="num mt-0.5 block font-normal text-ink-500">
              {selectionSummary(chosen.length, COMPARE_MAX, options.length)}
            </span>
          </span>
          <ChevronDown size={20} aria-hidden="true" className="acc-chevron shrink-0 text-ink-500" />
        </summary>
        <div className="border-t border-line px-4 pb-4 pt-3">
          <p className="text-small text-ink-500">
            Porównasz od 1 do {COMPARE_MAX} {pluralizePl(COMPARE_MAX, "oferty", "ofert", "ofert")}. Domyślnie pokazujemy{" "}
            {COMPARE_MAX} z najwyższą oceną serwisu w tej grupie.
          </p>
          <fieldset className="mt-2 min-w-0">
            <legend className="sr-only">Oferty w tabeli porównania</legend>
            <ul className="grid max-h-80 gap-x-6 overflow-y-auto sm:grid-cols-2">
              {options.map((option) => {
                const checked = chosen.includes(option.slug);
                const disabled = checked ? onlyOne : full;
                return (
                  <li key={option.slug}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 has-[:disabled]:cursor-not-allowed">
                      <input
                        type="checkbox"
                        className="checkbox mt-[1px]"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => toggle(option.slug, event.target.checked)}
                      />
                      <span className={disabled && !checked ? "text-small text-ink-500" : "text-small text-ink-900"}>
                        <span className="font-semibold">{option.bank}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, </span>
                        {option.name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          {full ? (
            <p className="mt-2 text-small text-ink-500">Wybrano maksymalną liczbę ofert. Odznacz jedną, aby dodać inną.</p>
          ) : null}
          {!isDefault ? (
            <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => go(compareUrl(segment, null))}>
              Wróć do najwyżej ocenianych
            </Button>
          ) : null}
        </div>
      </details>
    </div>
  );
}
