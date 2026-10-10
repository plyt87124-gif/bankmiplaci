"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { Segment } from "@/components/ui/Segment";
import type { HomeSeeAll, HomeSegment } from "./homeModel";

/**
 * The client island of the home page: the "Konta osobiste | Konta firmowe"
 * control in the hero and everything that follows its state - the
 * "Zobacz promocje" button, the "Polecane promocje" list and its
 * "Zobacz wszystkie (N)" link. The state is plain UI state (no URL change, no
 * storage): the first render is always the default segment, so the server HTML
 * and the first client render are identical.
 *
 * What crosses the server/client boundary is deliberately small:
 *  - `segments`: value, label, link target and the number for the link - text
 *    and numbers only, no offers;
 *  - `panels`: the lists as already rendered React nodes. Both segments are in
 *    the HTML (the inactive one is `hidden`), so the cards need no client
 *    code and no card data is serialised a second time.
 * Nothing private (affiliate URL, commission) can be in either: the cards come
 * from promotionCards.ts, which never selects them.
 */
export interface HomeSegmentOption {
  value: HomeSegment;
  label: string;
  /** Where "Zobacz promocje" and "Zobacz wszystkie" lead while this segment is selected. */
  href: string;
  /** The number in "Zobacz wszystkie (N)". */
  count: number;
  /**
   * Target and text of the link under the "Polecane" list (homeModel: the segment's hub while it is
   * live, otherwise the filtered list). Text and a path only. Without it the link falls back to
   * `href` and "Zobacz wszystkie (count)".
   */
  seeAll?: HomeSeeAll;
}

interface HomeSegmentState {
  segment: HomeSegment | null;
  setSegment: (value: HomeSegment) => void;
  options: readonly HomeSegmentOption[];
  current: HomeSegmentOption | null;
}

const HomeSegmentContext = createContext<HomeSegmentState | null>(null);

function useHomeSegment(): HomeSegmentState {
  const state = useContext(HomeSegmentContext);
  if (!state) throw new Error("Home segment components must be rendered inside <HomeSegmentProvider>.");
  return state;
}

export function HomeSegmentProvider({
  options,
  initial,
  children
}: {
  /** Segments that have offers. Fewer than two = nothing to choose, no control. */
  options: readonly HomeSegmentOption[];
  initial: HomeSegment | null;
  children: ReactNode;
}) {
  const [segment, setSegment] = useState<HomeSegment | null>(initial);
  const value = useMemo<HomeSegmentState>(
    () => ({
      segment,
      setSegment,
      options,
      current: options.find((option) => option.value === segment) ?? options[0] ?? null
    }),
    [segment, options]
  );
  return <HomeSegmentContext.Provider value={value}>{children}</HomeSegmentContext.Provider>;
}

/** "Konta osobiste | Konta firmowe" (radiogroup) with a line saying what it changes. Nothing when there is only one segment. */
export function HomeSegmentControl({ className }: { className?: string }) {
  const { options, current, setSegment } = useHomeSegment();
  if (options.length < 2 || !current) return null;
  return (
    <div className={className}>
      <Segment
        label="Typ konta"
        options={options.map((option) => ({ value: option.value, label: option.label }))}
        value={current.value}
        onChange={setSegment}
      />
      <p className="mt-2 text-small text-ink-500">Wybór zmienia listę „Polecane promocje” poniżej.</p>
    </div>
  );
}

/** A link styled as a button that leads to the list of the selected segment (the whole list when there is no choice). */
export function HomeSegmentLink({
  children,
  variant = "primary",
  size = "md",
  className,
  fallbackHref = "/promocje"
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  fallbackHref?: string;
}) {
  const { current } = useHomeSegment();
  return (
    <Link href={current?.href ?? fallbackHref} className={buttonClasses({ variant, size, className })}>
      {children}
    </Link>
  );
}

/** The link under the "Polecane" list for the selected segment ("Wszystkie konta osobiste z premią (N)" or "Zobacz wszystkie (N)"). */
export function HomeSeeAllLink({ className }: { className?: string }) {
  const { current } = useHomeSegment();
  if (!current) return null;
  const href = current.seeAll?.href ?? current.href;
  const label = current.seeAll?.label ?? `Zobacz wszystkie (${current.count})`;
  return (
    <Link href={href} className={buttonClasses({ variant: "secondary", size: "md", className })}>
      <span>{label}</span>
    </Link>
  );
}

export interface HomePanel {
  value: HomeSegment;
  content: ReactNode;
}

/**
 * The lists of all segments; only the selected one is visible (`hidden` on the
 * others, so it is neither shown nor read nor focusable). A caption names the
 * list (the control is far above it once the visitor has scrolled) and a polite
 * status announces a change to assistive technology.
 */
export function HomeSegmentPanels({ panels, className }: { panels: readonly HomePanel[]; className?: string }) {
  const { options, current } = useHomeSegment();
  const choosable = options.length >= 2;
  return (
    <div className={className}>
      {choosable && current ? (
        <p className="type-label mb-3 text-ink-500">{current.label}</p>
      ) : null}
      {panels.map((panel) => (
        <div key={panel.value} data-segment={panel.value} hidden={current?.value !== panel.value}>
          {panel.content}
        </div>
      ))}
      {choosable && current ? (
        <p role="status" className="sr-only">
          {`Polecane promocje: ${current.label.toLowerCase()}`}
        </p>
      ) : null}
    </div>
  );
}
