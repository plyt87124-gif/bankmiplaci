/**
 * Theme helpers shared by layout.tsx (inline <head> script, server) and
 * ThemeToggle.tsx (client). No React, no side effects at import time.
 *
 * Preference model: localStorage["theme"] = "light" | "dark" | "system".
 * A missing or unknown value means DARK (the site's default since the v2 redesign; the
 * previous default was light - restore it by returning "light" below, in
 * readThemePreference and in THEME_INIT_SCRIPT). "system"
 * follows prefers-color-scheme live.
 */

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

/** Colours of the browser UI bar (viewport.themeColor) = paper in each theme. */
export const THEME_COLORS = { light: "#f9f7f2", dark: "#111317" } as const;

export const THEME_LABEL: Record<ThemePreference, string> = {
  light: "Jasny",
  dark: "Ciemny",
  system: "Automatyczny"
};

export const THEME_ORDER: ThemePreference[] = ["light", "dark", "system"];

export function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(index + 1) % THEME_ORDER.length] ?? "light";
}

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "system" ? value : "dark";
}

export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked (private mode etc.): the choice simply lasts for this page view.
  }
}

export function resolveIsDark(preference: ThemePreference): boolean {
  if (preference === "dark") return true;
  if (preference === "system") {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  }
  return false;
}

/** Applies the resolved theme to <html> and to the theme-color meta tags. */
export function applyTheme(preference: ThemePreference): boolean {
  const dark = resolveIsDark(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  const color = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", color));
  return dark;
}

/**
 * Runs inline in <head>, before first paint: sets `.dark` from the saved
 * preference (no flash of the wrong theme) and `.motion-ok` unless the user
 * asked for reduced motion (see src/styles/motion.css). Plain ES5 on purpose;
 * both blocks are wrapped in try/catch because storage and matchMedia can throw.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;var dark=true;try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t)dark=t!=="light"&&(t!=="system"||window.matchMedia("(prefers-color-scheme: dark)").matches)}catch(e){}if(dark)d.classList.add("dark");try{var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",dark?"${THEME_COLORS.dark}":"${THEME_COLORS.light}");if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.add("motion-ok")}catch(e){}})();`;
