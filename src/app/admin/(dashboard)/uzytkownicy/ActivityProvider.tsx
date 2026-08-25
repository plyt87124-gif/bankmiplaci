"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const POLL_INTERVAL_MS = 15000;

export type ActivityStatus = "inactive" | "active" | "active-new";

interface ActivityContextValue {
  getStatus: (userId: string) => ActivityStatus;
}

const ActivityContext = createContext<ActivityContextValue>({ getStatus: () => "inactive" });

export function useActivityStatus(userId: string): ActivityStatus {
  return useContext(ActivityContext).getStatus(userId);
}

export function ActivityProvider({
  initialUsers,
  children
}: {
  initialUsers: { id: string; lastLoginAt: string | null }[];
  children: React.ReactNode;
}) {
  const pageLoadTime = useRef(Date.now());
  const [lastLoginById, setLastLoginById] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initialUsers.map((u) => [u.id, u.lastLoginAt]))
  );

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/admin/users/activity");
        const data = await res.json();
        if (data?.users) {
          setLastLoginById(Object.fromEntries(data.users.map((u: { id: string; lastLoginAt: string | null }) => [u.id, u.lastLoginAt])));
        }
      } catch {
        // Ignore transient polling failures.
      }
    }
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function getStatus(userId: string): ActivityStatus {
    const lastLoginAt = lastLoginById[userId];
    if (!lastLoginAt) return "inactive";
    const loginTime = new Date(lastLoginAt).getTime();
    if (Date.now() - loginTime > ACTIVE_WINDOW_MS) return "inactive";
    // Logged in after this admin tab was opened — freshly active.
    if (loginTime > pageLoadTime.current) return "active-new";
    return "active";
  }

  return <ActivityContext.Provider value={{ getStatus }}>{children}</ActivityContext.Provider>;
}
