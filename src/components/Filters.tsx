"use client";

import { useCallback, useEffect, useId, useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Segment, type SegmentOption } from "@/components/ui/Segment";
import { Select } from "@/components/ui/Select";
import { FilterFields } from "@/components/filters/FilterFields";
import { FilterSheet } from "@/components/filters/FilterSheet";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildChips,
  clearChips,
  describeResultCount,
  effectiveSort,
  listingHref,
  panelFilterCount,
  parseListingParams,
  segmentOf,
  toQueryString,
  type ListingSort,
  type ListingState,
  type SegmentValue
} from "@/components/filters/filterParams";
import { useCommittedValue } from "@/components/filters/useCommittedValue";
import { pluralizePl } from "@/lib/format";

export interface SegmentCounts {
  all: number;
  PERSONAL: number;
  BUSINESS: number;
}

export interface FiltersProps {
  /** Banks for the "Bank" select. */
  banks: readonly { slug: string; name: string }[];
  /** Offers matching the current URL (all pages). Drives the live counter and the sheet button. */
  resultCount?: number;
  /** Offers visible on screen now (first page(s)); shown as "Pokazujemy 24 z 35". */
  shownCount?: number;
  /** Counts for Wszystkie / Osobiste / Firmowe, under the other active filters. */
  segmentCounts?: SegmentCounts;
  /** The server-rendered results (cards, empty state, "Pokaż więcej"). Dimmed and aria-busy while a change loads. */
  children?: ReactNode;
}

const SEGMENT_DELAY_MS = 150;
const SEARCH_DELAY_MS = 350;

const normalizeQuery = (value: string) => value.replace(/\s+/g, " ").trim();
const sameQuery = (a: string, b: string) => normalizeQuery(a) === normalizeQuery(b);

/**
 * Toolbar + filters of /promocje, wrapped around the server-rendered results:
 *
 *   Osobiste / Firmowe segment -> search + sort (+ "Filtry (n)" below xl) ->
 *   description of the active sort -> chips of active filters + "Wyczyść" ->
 *   live counter (role=status) -> `children`.
 *
 * From xl the difficulty / bank / minimum bonus / "no fee" fields sit in a
 * 16 rem side panel; below xl they open in a bottom sheet (native <dialog>).
 *
 * State lives in the URL (searchParams); every change is
 * `router.replace(url, { scroll: false })` inside a transition. While it
 * loads, `useOptimistic` already shows the new values (nothing flickers back),
 * `children` get `aria-busy` and dim after 150 ms (see .pending-fade in
 * motion.css), and a thin bar runs along the top of the results.
 * Typing and arrowing through the segment are debounced so the URL is written
 * once, not once per key press. Only the whitelisted parameters are written
 * (see filterParams.ts); a filter change always starts from the first page.
 */
export function Filters({ banks, resultCount, shownCount, segmentCounts, children }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const paramsKey = searchParams.toString();
  const urlState = useMemo(() => parseListingParams(new URLSearchParams(paramsKey)), [paramsKey]);
  const [state, applyOptimistic] = useOptimistic(urlState, (current: ListingState, patch: Partial<ListingState>) => ({
    ...current,
    ...patch
  }));

  // The state we are heading to. It runs ahead of the URL while a navigation is
  // in flight, so two quick changes (two chips, a chip and the sort) combine
  // instead of the second overwriting the first. It is re-synced from the URL
  // whenever nothing is loading.
  const intended = useRef(urlState);
  useEffect(() => {
    if (!isPending) intended.current = urlState;
  }, [urlState, isPending]);

  const navigate = useCallback(
    (patch: Partial<ListingState>) => {
      const next: ListingState = { ...intended.current, ...patch };
      if (toQueryString(next) === toQueryString(intended.current)) return;
      intended.current = next;
      const href = listingHref(next, 1, pathname);
      startTransition(() => {
        applyOptimistic(patch);
        router.replace(href, { scroll: false });
      });
    },
    [applyOptimistic, pathname, router]
  );

  const [segment, setSegment] = useCommittedValue<SegmentValue>(
    segmentOf(state),
    (value) => navigate({ accountType: value }),
    SEGMENT_DELAY_MS
  );
  const [queryDraft, setQueryDraft] = useCommittedValue<string>(
    state.q,
    (value) => navigate({ q: normalizeQuery(value) }),
    SEARCH_DELAY_MS,
    sameQuery
  );

  const ids = { search: useId(), sort: useId(), sheetTitle: useId() };
  const sort = effectiveSort(state);
  const chips = buildChips(state, banks);
  const panelCount = panelFilterCount(chips);

  const segmentOptions: SegmentOption<SegmentValue>[] = [
    { value: "", label: "Wszystkie", count: segmentCounts?.all },
    { value: "PERSONAL", label: "Osobiste", count: segmentCounts?.PERSONAL },
    { value: "BUSINESS", label: "Firmowe", count: segmentCounts?.BUSINESS }
  ];

  const sheetResults =
    resultCount != null
      ? `Pokaż ${resultCount} ${pluralizePl(resultCount, "wynik", "wyniki", "wyników")}`
      : "Pokaż wyniki";

  return (
    <div className="xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:items-start xl:gap-8">
      {/* Side panel: from xl only. Below xl the same fields open in the sheet. */}
      <div role="group" aria-label="Filtry ofert" className="hidden xl:sticky xl:top-24 xl:block">
        <div className="rounded-card border border-line bg-surface p-5">
          <p className="mb-5 text-h4 font-semibold text-ink-900">Filtry</p>
          <FilterFields idPrefix="panel" banks={banks} state={state} onChange={navigate} />
        </div>
      </div>

      <div className="min-w-0">
        <Segment label="Typ konta" options={segmentOptions} value={segment} onChange={(value) => setSegment(value)} />

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form
            role="search"
            aria-label="Wyszukiwarka promocji"
            className="min-w-0 flex-[1_1_11rem]"
            onSubmit={(event) => {
              event.preventDefault();
              setQueryDraft(queryDraft, true);
            }}
          >
            <Label htmlFor={ids.search}>Szukaj banku lub oferty</Label>
            <Input
              id={ids.search}
              type="search"
              name="q"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="np. mBank, firma, karta"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={100}
              className="h-11"
            />
          </form>

          <div className="min-w-0 flex-[2_1_19rem]">
            <Label htmlFor={ids.sort}>Sortuj</Label>
            <Select
              id={ids.sort}
              value={sort}
              onChange={(event) => {
                const value = event.target.value as ListingSort;
                navigate({ sort: value === DEFAULT_SORT ? "" : value });
              }}
              className="h-11 truncate"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <Button
            variant="secondary"
            aria-haspopup="dialog"
            onClick={() => setSheetOpen(true)}
            className="w-full sm:w-auto xl:hidden"
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
            Filtry{panelCount > 0 ? ` (${panelCount})` : ""}
          </Button>
        </div>

        {/* What the active order means - ALWAYS visible, also on mobile (trust plan, section 3). */}
        <AffiliateDisclosure variant="tag" sort={sort} long className="mt-3 block max-w-[68ch]" />

        {chips.length > 0 ? (
          <ul role="list" aria-label="Aktywne filtry" className="mt-4 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <li key={chip.id}>
                <button
                  type="button"
                  aria-label={chip.removeLabel}
                  onClick={() => navigate(chip.clear)}
                  className="relative inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink-100 pl-3 pr-2 text-small font-medium text-ink-900 before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-line"
                >
                  {chip.label}
                  <X size={16} aria-hidden="true" className="shrink-0 text-ink-500" />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => navigate(clearChips(state))}
                className="inline-flex min-h-11 items-center rounded-lg px-2 text-small font-semibold text-action hover:text-action-hover hover:underline hover:underline-offset-[3px]"
              >
                Wyczyść filtry
              </button>
            </li>
          </ul>
        ) : null}

        {resultCount != null ? (
          <p role="status" aria-live="polite" aria-atomic="true" className="mt-4 text-small text-ink-700">
            <span className="num font-semibold text-ink-900">{describeResultCount(resultCount, shownCount)}</span>
          </p>
        ) : null}

        <div className="relative mt-4">
          {isPending ? (
            <div
              aria-hidden="true"
              className="pending-bar absolute inset-x-0 -top-2 h-0.5 rounded-full bg-action"
            />
          ) : null}
          <div className="pending-fade" aria-busy={isPending ? "true" : "false"}>
            {children}
          </div>
        </div>
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtry"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                navigate({ bank: "", difficulty: [], minBonus: null, noFees: false })
              }
              disabled={panelCount === 0}
            >
              Wyczyść
            </Button>
            <Button onClick={() => setSheetOpen(false)} className="min-w-0 flex-1 sm:flex-none">
              {isPending ? "Aktualizuję wyniki…" : sheetResults}
            </Button>
          </>
        }
      >
        <FilterFields idPrefix="sheet" banks={banks} state={state} onChange={navigate} />
      </FilterSheet>
    </div>
  );
}
