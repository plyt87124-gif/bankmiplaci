"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ONLINE_WINDOW_MS } from "@/lib/activityWindows";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

const POLL_INTERVAL_MS = 15000;

export type ActivityTier = "online" | "today" | "week" | "month" | "old" | "never";

interface ActivityContextValue {
  getTier: (userId: string) => ActivityTier;
}

const ActivityContext = createContext<ActivityContextValue>({ getTier: () => "never" });

export function useActivityTier(userId: string): ActivityTier {
  return useContext(ActivityContext).getTier(userId);
}

export function tierFromLastSeen(lastSeenAt: string | null, now: number): ActivityTier {
  if (!lastSeenAt) return "never";
  const age = now - new Date(lastSeenAt).getTime();
  if (age <= ONLINE_WINDOW_MS) return "online";
  if (age <= DAY_MS) return "today";
  if (age <= WEEK_MS) return "week";
  if (age <= MONTH_MS) return "month";
  return "old";
}

export function ActivityProvider({
  initialUsers,
  children
}: {
  initialUsers: { id: string; lastSeenAt: string | null }[];
  children: React.ReactNode;
}) {
  const [lastSeenById, setLastSeenById] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initialUsers.map((u) => [u.id, u.lastSeenAt]))
  );
  // Re-derive tiers on a ticking clock too, not only on poll — otherwise a
  // user sitting on "online" would never age into "today" until the next
  // fetch happens to land after the 5-minute mark.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/admin/users/activity");
        const data = await res.json();
        if (data?.users) {
          setLastSeenById(Object.fromEntries(data.users.map((u: { id: string; lastSeenAt: string | null }) => [u.id, u.lastSeenAt])));
        }
      } catch {
        // Ignore transient polling failures.
      }
      setNow(Date.now());
    }
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function getTier(userId: string): ActivityTier {
    return tierFromLastSeen(lastSeenById[userId] ?? null, now);
  }

  return <ActivityContext.Provider value={{ getTier }}>{children}</ActivityContext.Provider>;
}
