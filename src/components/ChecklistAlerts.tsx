"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { isUrgent, type ChecklistAlertItem } from "@/lib/checklistDeadlines";
import { useOptionalSession } from "@/components/SessionProvider";

/**
 * Approaching ściąga deadlines for the whole site: the bell next to "Moje konto"
 * in the header (and on the mobile menu button) while the signed-in user browses
 * any page.
 *
 *  - Outside /konto the list comes from GET /api/checklist/alerts: once when the
 *    user is known, again after a page change or when the tab comes back to the
 *    front, but never more often than every REFRESH_MS (it is a hint, not a
 *    live feed).
 *  - On /konto the ściąga knows the real, current ticks. It publishes its own
 *    list (`publishLive`), which wins over the fetched one, so the bell in the
 *    header goes out the moment the last step is ticked. When the user leaves
 *    /konto the live list is dropped and the list is fetched again.
 *  - Without the provider (tests, a page rendered on its own) the hook answers
 *    "nothing approaching", so no component has to guard against its absence.
 */
const REFRESH_MS = 60_000;

interface ChecklistAlertsValue {
  items: readonly ChecklistAlertItem[];
  /** The ściąga on /konto reports its own, live list; `null` hands control back to the fetched one. */
  publishLive: (items: readonly ChecklistAlertItem[] | null) => void;
}

const NONE: ChecklistAlertsValue = { items: [], publishLive: () => {} };
const AlertsContext = createContext<ChecklistAlertsValue>(NONE);

export function ChecklistAlertsProvider({ children }: { children: ReactNode }) {
  const session = useOptionalSession();
  const userId = session?.user?.id ?? null;
  const pathname = usePathname();
  const [fetched, setFetched] = useState<readonly ChecklistAlertItem[]>([]);
  const [live, setLive] = useState<readonly ChecklistAlertItem[] | null>(null);
  const lastFetchAt = useRef(0);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    lastFetchAt.current = Date.now();
    try {
      const res = await fetch("/api/checklist/alerts", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: unknown };
      if (id !== requestId.current) return;
      setFetched(Array.isArray(data.items) ? (data.items as ChecklistAlertItem[]) : []);
    } catch {
      // The bell is a hint: a failed request just leaves what we showed before.
    }
  }, []);

  // Who is signed in changed: forget the previous user's fetched list, ask for the new one. The live list is NOT
  // reset here: child effects run before this one, so the ściąga's first `publishLive` would be wiped on mount.
  // (Signing out hides it anyway: `items` is empty without a user, and the ściąga unmounts and hands control back.)
  useEffect(() => {
    requestId.current++;
    setFetched([]);
    if (userId) void load();
  }, [userId, load]);

  // A page change or coming back to the tab: refresh, at most once a minute.
  useEffect(() => {
    if (!userId) return;
    if (Date.now() - lastFetchAt.current >= REFRESH_MS) void load();
  }, [pathname, userId, load]);
  useEffect(() => {
    if (!userId) return;
    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - lastFetchAt.current >= REFRESH_MS) void load();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, load]);

  const publishLive = useCallback(
    (items: readonly ChecklistAlertItem[] | null) => {
      setLive(items);
      // Leaving /konto: the ticks may have changed there, so do not trust the older fetched list.
      if (items === null && userId) void load();
    },
    [userId, load]
  );

  const value = useMemo<ChecklistAlertsValue>(
    () => ({ items: userId ? (live ?? fetched) : [], publishLive }),
    [userId, live, fetched, publishLive]
  );
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useChecklistAlerts(): ChecklistAlertsValue {
  return useContext(AlertsContext);
}

/** Screen-reader text of the bell: what is approaching, in one sentence. */
export function alertsSummary(items: readonly ChecklistAlertItem[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) {
    const [item] = items;
    return `Zbliża się termin w ściądze: ${item!.bankName}, ${item!.groupLabel}`;
  }
  return `Zbliżają się terminy w ściądze: ${items.length}`;
}

/**
 * The bell: an icon in the "warn" colour (red when a deadline is 2 days away or
 * less) with a small dot. The words are for assistive technology and the
 * tooltip; the visible part is only the icon. Renders nothing for an empty list.
 */
export function ChecklistBell({
  items,
  size = 18,
  className
}: {
  items: readonly ChecklistAlertItem[];
  size?: number;
  className?: string;
}) {
  if (items.length === 0) return null;
  const urgent = items.some((i) => isUrgent(i.daysLeft));
  const summary = alertsSummary(items);
  return (
    <span data-checklist-bell={urgent ? "urgent" : "soon"} title={summary} className={cn("relative inline-flex shrink-0", className)}>
      <Bell size={size} aria-hidden="true" className={urgent ? "text-coral-600" : "text-warn"} />
      <span
        aria-hidden="true"
        className={cn(
          "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-paper",
          urgent ? "bg-coral-600" : "bg-warn"
        )}
      />
      <span className="sr-only">{summary}</span>
    </span>
  );
}
