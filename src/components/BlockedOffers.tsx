"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Clock, ListChecks, Lock, type LucideIcon } from "lucide-react";
import { useOptionalSession } from "@/components/SessionProvider";
import { formatDatePL } from "@/lib/format";

export type ClientMark =
  | { slug: string; reason: "client" }
  | { slug: string; reason: "karencja"; until: string | null }
  | { slug: string; reason: "joined" };

const MarksContext = createContext<ReadonlyMap<string, ClientMark>>(new Map());
const FilterContext = createContext<{ onlyEligible: boolean; count: number }>({ onlyEligible: false, count: 0 });

/** The "only offers I can join" setting of the signed-in visitor and how many offers it hides. */
export function useViewerFilter() {
  return useContext(FilterContext);
}

/**
 * Knows what the signed-in visitor should be told on top of each offer (client of that bank, karencja, ściąga
 * already open) and hands it to the cards (CardBlockedMark). One small request per session user, only for
 * signed-in visitors; failures mean "no marks".
 */
export function BlockedOffersProvider({ children }: { children: ReactNode }) {
  const session = useOptionalSession();
  const userId = session?.user?.id ?? null;
  const [marks, setMarks] = useState<ReadonlyMap<string, ClientMark>>(new Map());
  const [onlyEligible, setOnlyEligible] = useState(false);

  useEffect(() => {
    if (!userId) {
      setMarks(new Map());
      setOnlyEligible(false);
      return;
    }
    let cancelled = false;
    fetch("/api/eligibility/blocked", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: unknown; onlyEligible?: unknown }) => {
        if (cancelled) return;
        const items = Array.isArray(data.items) ? (data.items as ClientMark[]) : [];
        setMarks(new Map(items.filter((m) => m && typeof m.slug === "string").map((m) => [m.slug, m])));
        setOnlyEligible(data.onlyEligible === true);
      })
      .catch(() => {
        if (!cancelled) setMarks(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <FilterContext.Provider value={{ onlyEligible, count: marks.size }}>
      <MarksContext.Provider value={marks}>{children}</MarksContext.Provider>
    </FilterContext.Provider>
  );
}

const COPY: Record<ClientMark["reason"], { icon: LucideIcon; title: string }> = {
  client: { icon: Lock, title: "Już jesteś klientem" },
  karencja: { icon: Clock, title: "Karencja trwa" },
  joined: { icon: ListChecks, title: "Masz tę ściągę" }
};

function detail(mark: ClientMark): string {
  if (mark.reason === "client") return "Promocja tylko dla nowych klientów";
  if (mark.reason === "karencja") return mark.until ? `Dołączysz od ${formatDatePL(mark.until)}` : "Nie spełniasz warunku banku";
  return "Postęp w „Moje konto”";
}

/**
 * Rendered inside an offer card: when the visitor cannot join (client of the bank, karencja) or already has the
 * ściąga open, a frosted veil with a short message sits IN FRONT of the card (the card underneath is untouched).
 * The veil lets clicks through and fades away on hover so the card can be read. Renders nothing otherwise.
 */
export function CardBlockedMark({ slug }: { slug: string }) {
  const mark = useContext(MarksContext).get(slug);
  if (!mark) return null;
  const { icon: Icon, title } = COPY[mark.reason];
  const tone = mark.reason === "joined" ? "ring-action/40 text-action" : "ring-coral-600/45 text-coral-600";
  return (
    <div
      data-card-mark={mark.reason}
      className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-card bg-paper/70 p-3 transition-opacity duration-300 group-hover:opacity-0"
    >
      <div className={`flex max-w-[85%] items-center gap-3 rounded-field bg-surface px-4 py-2.5 shadow-lg ring-1 ${tone}`}>
        <Icon size={22} aria-hidden="true" className="shrink-0" />
        <p className="text-small leading-snug">
          <span className="block font-semibold text-ink-900">{title}</span>
          <span className="block text-ink-700">{detail(mark)}</span>
        </p>
      </div>
    </div>
  );
}
