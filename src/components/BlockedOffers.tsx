"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useOptionalSession } from "@/components/SessionProvider";

const BlockedContext = createContext<ReadonlySet<string>>(new Set());

/**
 * Knows which offers the signed-in visitor cannot take part in (karencja) and
 * hands the slugs to the cards (CardBlockedMark). One small request per
 * session user, only for signed-in visitors; failures mean "none blocked".
 */
export function BlockedOffersProvider({ children }: { children: ReactNode }) {
  const session = useOptionalSession();
  const userId = session?.user?.id ?? null;
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setBlocked(new Set());
      return;
    }
    let cancelled = false;
    fetch("/api/eligibility/blocked", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { slugs: [] }))
      .then((data: { slugs?: unknown }) => {
        if (cancelled) return;
        const slugs = Array.isArray(data.slugs) ? data.slugs.filter((s): s is string => typeof s === "string") : [];
        setBlocked(new Set(slugs));
      })
      .catch(() => {
        if (!cancelled) setBlocked(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <BlockedContext.Provider value={blocked}>{children}</BlockedContext.Provider>;
}

/**
 * Rendered inside an offer card: when the visitor is blocked from this offer
 * it marks the card (`data-blocked`, the red glow in motion.css) and says so
 * in words for screen readers. Renders nothing otherwise.
 */
export function CardBlockedMark({ slug }: { slug: string }) {
  const blocked = useContext(BlockedContext).has(slug);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);

  useEffect(() => {
    const card = anchor?.closest<HTMLElement>("[data-card]");
    if (!card) return;
    if (blocked) card.setAttribute("data-blocked", "true");
    else card.removeAttribute("data-blocked");
    return () => card.removeAttribute("data-blocked");
  }, [anchor, blocked]);

  return (
    <span ref={setAnchor} className="sr-only">
      {blocked ? "Prawdopodobnie nie kwalifikujesz się – karencja." : null}
    </span>
  );
}
