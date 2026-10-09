"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Imperative read of the OS "reduce motion" setting, for effects and event
 * handlers (always fresh, no re-render). Server / no matchMedia -> false;
 * the caller must never put the result into server-rendered markup.
 */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia(QUERY).matches;
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  try {
    const mql = window.matchMedia(QUERY);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  } catch {
    return () => {};
  }
}

/**
 * Reactive version for components that switch behaviour live. The server
 * snapshot is `false`, so use the value in effects / event handlers rather
 * than to branch the markup (that would not match the server HTML).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
