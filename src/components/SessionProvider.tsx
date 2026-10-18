"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Client-side view of "who is signed in".
 *
 * Today the root layout still reads the session cookie on the server and hands
 * the result over as `initialUser` (so nothing changes for visitors: the first
 * paint already knows the user). The provider adds what the layout cannot:
 *  - `useSession()` for any client component, without prop drilling,
 *  - `refresh()` that asks `/api/account/me` (non-sensitive data, `no-store`),
 *    used after signing in/up so the UI does not wait for a server round trip,
 *  - the groundwork for WP-17, which removes the cookie read from the layout:
 *    mount the provider WITHOUT `initialUser` and it fetches the session itself
 *    (`status: "loading"` until the answer arrives).
 *
 * When the layout re-renders with a different `initialUser` (router.refresh()
 * after a sign-in or sign-out) the server's answer wins over the local one.
 */

/** The only user data the client keeps: no e-mail, no dates, no consent data. */
export interface SessionUser {
  id: string;
  name: string | null;
}

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface SessionValue {
  user: SessionUser | null;
  status: SessionStatus;
  /** Re-reads the session from `/api/account/me`; resolves to the user (null = signed out). */
  refresh: () => Promise<SessionUser | null>;
}

/** undefined = not known yet (nothing was passed and nothing has been fetched). */
type KnownUser = SessionUser | null | undefined;

const SessionContext = createContext<SessionValue | null>(null);

export function toSessionUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object") return null;
  const { id, name } = value as { id?: unknown; name?: unknown };
  if (typeof id !== "string" || id === "") return null;
  return { id, name: typeof name === "string" ? name : null };
}

function userKey(user: KnownUser): string {
  if (user === undefined) return "?";
  if (user === null) return "-";
  return `${user.id}|${user.name ?? ""}`;
}

/** Strips a richer object (the layout passes the whole `getCurrentUser()` row) down to SessionUser. */
function normalizeInitial(value: unknown): KnownUser {
  return value === undefined ? undefined : toSessionUser(value);
}

export function SessionProvider({
  initialUser,
  children
}: {
  /** Server's answer: a user object, `null` (signed out) or omitted (unknown, fetch on mount). */
  initialUser?: { id: string; name: string | null } | null;
  children: ReactNode;
}) {
  const initial = normalizeInitial(initialUser);
  const initialKey = userKey(initial);
  const [state, setState] = useState<{ key: string; user: KnownUser }>({ key: initialKey, user: initial });
  const requestId = useRef(0);
  const latest = useRef<KnownUser>(state.user);

  // The server rendered something different than before (e.g. router.refresh()
  // after a sign-in): adopt it. Adjusting state during render is the supported
  // way to derive state from a changed prop.
  if (state.key !== initialKey) {
    setState({ key: initialKey, user: initial });
  }
  latest.current = state.user;

  const refresh = useCallback(async (): Promise<SessionUser | null> => {
    const id = ++requestId.current;
    let fetched: SessionUser | null | undefined;
    try {
      const res = await fetch("/api/account/me", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { user?: unknown };
      fetched = toSessionUser(data?.user);
    } catch {
      fetched = undefined; // network/server error: keep what we knew
    }

    // A newer refresh() started meanwhile: let that one decide.
    if (id !== requestId.current) return latest.current ?? null;

    if (fetched === undefined) {
      // Never leave the UI stuck in "loading": unknown + failed = treat as signed out.
      setState((prev) => (prev.user === undefined ? { key: prev.key, user: null } : prev));
      return latest.current ?? null;
    }
    setState((prev) => ({ key: prev.key, user: fetched }));
    return fetched;
  }, []);

  // No initial answer from the server: ask for it once.
  const needsFetch = initialUser === undefined;
  useEffect(() => {
    if (needsFetch) void refresh();
  }, [needsFetch, refresh]);

  const value = useMemo<SessionValue>(() => {
    const user = state.user ?? null;
    return {
      user,
      status: state.user === undefined ? "loading" : user ? "authenticated" : "unauthenticated",
      refresh
    };
  }, [state.user, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Current session. Must be used under <SessionProvider> (the root layout mounts it via AuthModalProvider). */
export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Like useSession, but null when there is no provider (lets AuthModalProvider add one only when needed). */
export function useOptionalSession(): SessionValue | null {
  return useContext(SessionContext);
}
