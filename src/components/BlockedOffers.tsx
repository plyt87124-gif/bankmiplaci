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
 * Blocked (client, karencja) is red, "you already have it" is blue. A muted tint with a thin border of the same
 * hue, text in that hue. The tint is a `before:` layer over a solid `bg-paper` base: a tint on its own is
 * see-through, and the offer card underneath would show through the message.
 */
const TONE: Record<ClientMark["reason"], string> = {
  client: "border-coral-600/50 text-coral-600 before:bg-coral-600/[0.16]",
  karencja: "border-coral-600/50 text-coral-600 before:bg-coral-600/[0.16]",
  joined: "border-action/45 text-action before:bg-action/[0.14]"
};

/** The tinted message itself: bold icon on top, title and detail centred under it. */
export function BlockedMarkBox({ mark }: { mark: ClientMark }) {
  const { icon: Icon, title } = COPY[mark.reason];
  return (
    <div
      className={`relative flex max-w-[85%] flex-col items-center gap-2 overflow-hidden rounded-field border bg-paper px-5 py-3.5 text-center before:absolute before:inset-0 before:content-[''] ${TONE[mark.reason]}`}
    >
      <Icon size={28} strokeWidth={2.75} aria-hidden="true" className="relative shrink-0" />
      <p className="relative text-small leading-snug">
        <span className="block font-bold">{title}</span>
        <span className="block font-medium">{detail(mark)}</span>
      </p>
    </div>
  );
}

/**
 * Rendered inside an offer card: when the visitor cannot join (client of the bank, karencja) or already has the
 * ściąga open, a frosted veil with a short message sits IN FRONT of the card (the card underneath is untouched).
 * The veil lets clicks through and fades away on hover so the card can be read. Renders nothing otherwise.
 */
export function CardBlockedMark({ slug }: { slug: string }) {
  const mark = useContext(MarksContext).get(slug);
  if (!mark) return null;
  return (
    <div
      data-card-mark={mark.reason}
      className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-card bg-paper/70 p-3 transition-opacity duration-300 group-hover:opacity-0"
    >
      <BlockedMarkBox mark={mark} />
    </div>
  );
}
