"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  THEME_LABEL,
  THEME_STORAGE_KEY,
  applyTheme,
  nextThemePreference,
  readThemePreference,
  saveThemePreference,
  type ThemePreference
} from "@/components/ui/theme";

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

// The header renders a toggle for desktop AND one for mobile. Every change is
// broadcast so all instances (and other tabs, via `storage`) show the same state.
const THEME_CHANGE_EVENT = "bmp:themechange";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) {
      applyTheme(readThemePreference());
      onChange();
    }
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** `null` on the server and during hydration: the button renders empty, then fills in. */
function useThemePreference(): ThemePreference | null {
  return useSyncExternalStore<ThemePreference | null>(subscribe, readThemePreference, () => null);
}

/**
 * Three-state theme switch: Jasny -> Ciemny -> Automatyczny -> Jasny.
 * One 44x44 button; the icon shows the CURRENT state, the accessible name says
 * what a click does. The saved preference is read after mount (the real
 * theme is already applied by the inline script in <head>, so there is no
 * flash) - until then the button renders empty, keeping server and client
 * markup identical.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useThemePreference();
  // Set only after the user clicks, so nothing is announced on page load.
  const [announcement, setAnnouncement] = useState("");

  // Re-assert the saved theme after hydration (idempotent; the head script did it already).
  useEffect(() => {
    applyTheme(readThemePreference());
  }, []);

  // In "system" mode, follow the OS while the page is open.
  useEffect(() => {
    if (preference !== "system") return;
    let query: MediaQueryList;
    try {
      query = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  function cycle() {
    // Read the stored value, not the render-time one: another toggle may have changed it.
    const next = nextThemePreference(readThemePreference());
    saveThemePreference(next);
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    setAnnouncement(`Motyw: ${THEME_LABEL[next]}`);
  }

  const Icon = preference ? ICONS[preference] : null;
  const label = preference
    ? `Motyw: ${THEME_LABEL[preference]}. Kliknij, aby zmienić na: ${THEME_LABEL[nextThemePreference(preference)]}.`
    : "Zmień motyw";

  return (
    <>
      <button
        type="button"
        onClick={cycle}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-transparent text-ink-700 transition-colors duration-150 ease-out hover:bg-ink-100",
          className
        )}
      >
        {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
