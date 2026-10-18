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
  focusAfterChipRemoval,
  listingHref,
  panelFilterCount,
  parseListingParams,
  segmentOf,
  toQueryString,
  type ChipFocusTarget,
  type FilterChip,
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
  /** Banks for the "Bank" select and the chip (include the bank of the URL even when it has no offers). */
  banks: readonly { slug: string; name: string }[];
  /** Offers matching the current URL (all pages). Drives the live counter and the sheet button. */
  resultCount?: number;
  /** Offers visible on screen now (first page(s)); shown as "Pokazujemy 24 z 35". */
  shownCount?: number;
  /** Counts for Wszystkie / Osobiste / Firmowe, under the other active filters. */
  segmentCounts?: SegmentCounts;
  /**
   * Render the affiliate-disclosure strip above the toolbar. It lives HERE and
   * not in the page so that it follows the same (optimistic) sort as the
   * description under the sort control: the two sentences about the ranking can
   * never contradict each other while a new order loads.
   */
  disclosureStrip?: boolean;
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
 *   disclosure strip -> Osobiste / Firmowe segment -> search + sort + "Filtry (n)" ->
 *   description of the active sort -> chips of active filters + "Wyczyść" ->
 *   live counter (role=status) -> `children`.
 *
 * At every width the difficulty / bank / minimum bonus / "no fee" fields open
 * in a bottom sheet (native <dialog>) from the "Filtry (n)" button, and the
 * active ones are always visible as chips (docs/redesign-v2/02-layout-spec.md:
 * filters in the bar + a sheet, no permanent side panel, so the offer grid
 * keeps its 1 / 2 / 3 columns).
 *
 * State lives in the URL (searchParams); every change is
 * `router.replace(url, { scroll: false })` inside a transition. While it
 * loads, `useOptimistic` already shows the new values (nothing flickers back),
 * `children` get `aria-busy` and dim after 150 ms (see .pending-fade in
 * motion.css), and a thin bar runs along the top of the results.
 * Typing and arrowing through the segment are debounced so the URL is written
 * once, not once per key press. Only the whitelisted parameters are written
 * (see filterParams.ts); a filter change always starts from the first page.
 *
 * Keyboard focus is never left on <body> (WCAG 2.4.3): removing a chip moves it
 * to a neighbouring chip or to the result counter; when something the focus
 * was in disappears from the results (the "Pokaż więcej" link after the last
 * page, "Wyczyść filtry" of the empty state) it moves to the counter too.
 */
export function Filters({ banks, resultCount, shownCount, segmentCounts, disclosureStrip = false, children }: FiltersProps) {
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
  // ONE sort for everything that talks about the ranking (the disclosure strip,
  // the description under the control, the select): the optimistic one.
  const sort = effectiveSort(state);
  const chips = buildChips(state, banks);
  const panelCount = panelFilterCount(chips);

  /* ---------------------------- keyboard focus ---------------------------- */

  const chipListRef = useRef<HTMLUListElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
  /** Where the focus goes once the chips re-render without the removed one. */
  const pendingFocus = useRef<ChipFocusTarget | null>(null);
  /** The last element inside the results that had the focus (to notice when it disappears). */
  const lastResultsFocus = useRef<HTMLElement | null>(null);

  function focusStatus(options?: FocusOptions) {
    const status = statusRef.current;
    if (status) status.focus(options);
    else searchFormRef.current?.querySelector("input")?.focus(options);
  }

  const chipKey = chips.map((chip) => chip.id).join("|");
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target.kind === "chip") {
      const button = Array.from(chipListRef.current?.querySelectorAll<HTMLElement>("[data-chip-id]") ?? []).find(
        (element) => element.dataset.chipId === target.id
      );
      if (button) {
        button.focus();
        return;
      }
    }
    focusStatus();
  }, [chipKey]);

  // A focused element of the results (the "Pokaż więcej" link on the last page,
  // the "Wyczyść filtry" button of the empty state, a card) can be removed by
  // the new server render; the focus would drop to <body>. Runs after every
  // commit, but only acts when the remembered element is gone AND nothing else
  // has the focus.
  useEffect(() => {
    const last = lastResultsFocus.current;
    if (!last || last.isConnected) return;
    lastResultsFocus.current = null;
    const active = document.activeElement;
    // preventScroll: a mouse user who pressed "Pokaż więcej" far down the page must not be thrown back to the top.
    if (!active || active === document.body) focusStatus({ preventScroll: true });
  });

  function removeChip(chip: FilterChip) {
    pendingFocus.current = focusAfterChipRemoval(
      chips.map((item) => item.id),
      chip.id
    );
    navigate(chip.clear);
  }

  function clearAllChips() {
    pendingFocus.current = { kind: "status" };
    navigate(clearChips(state));
  }

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
    <div>
      {/* Above EVERY list of offers; the wording follows the active (optimistic) sort. */}
      {disclosureStrip ? <AffiliateDisclosure variant="strip" sort={sort} className="max-w-3xl" /> : null}

      <div className="min-w-0">
        <Segment
          label="Typ konta"
          size="sm"
          options={segmentOptions}
          value={segment}
          onChange={(value) => setSegment(value)}
          className={disclosureStrip ? "mt-6" : undefined}
        />

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form
            ref={searchFormRef}
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
            className="w-full sm:w-auto"
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
            Filtry{panelCount > 0 ? ` (${panelCount})` : ""}
          </Button>
        </div>

        {chips.length > 0 ? (
          <ul ref={chipListRef} role="list" aria-label="Aktywne filtry" className="mt-4 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <li key={chip.id}>
                <button
                  type="button"
                  data-chip-id={chip.id}
                  aria-label={chip.removeLabel}
                  onClick={() => removeChip(chip)}
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
                onClick={clearAllChips}
                className="inline-flex min-h-11 items-center rounded-lg px-2 text-small font-semibold text-action hover:text-action-hover hover:underline hover:underline-offset-[3px]"
              >
                Wyczyść filtry
              </button>
            </li>
          </ul>
        ) : null}

        {resultCount != null ? (
          <p
            ref={statusRef}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={-1}
            className="mt-4 rounded-sm text-small text-ink-700"
          >
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
          <div
            className="pending-fade"
            aria-busy={isPending ? "true" : "false"}
            onFocus={(event) => {
              lastResultsFocus.current = event.target as HTMLElement;
            }}
            onBlur={(event) => {
              // Moving the focus to something outside the results forgets it; a removal gives relatedTarget null and keeps it.
              const next = event.relatedTarget as Node | null;
              if (next && !event.currentTarget.contains(next)) lastResultsFocus.current = null;
            }}
          >
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
            {/* aria-disabled, not disabled: a disabled button drops the keyboard focus to <body> right after it is pressed. */}
            <Button
              variant="ghost"
              aria-disabled={panelCount === 0 || undefined}
              onClick={() => {
                if (panelCount === 0) return;
                navigate({ bank: "", difficulty: [], minBonus: null, noFees: false });
              }}
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
