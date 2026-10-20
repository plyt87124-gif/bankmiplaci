"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tile";
type Tile = "flat" | "a" | "b" | "c" | "d";

const OPTIONS: { value: Tile; label: string }[] = [
  { value: "flat", label: "Płaski" },
  { value: "a", label: "A Uniesiony" },
  { value: "b", label: "B Szkło" },
  { value: "c", label: "C Stos" },
  { value: "d", label: "D Fazowany" }
];

function current(): Tile {
  try {
    const value = document.documentElement.getAttribute("data-tile");
    return OPTIONS.some((o) => o.value === value) ? (value as Tile) : "flat";
  } catch {
    return "flat";
  }
}

/**
 * TEMPORARY comparison switch (development builds only, see layout.tsx): four ways to lift the offer tiles above the
 * page plane (see src/styles/motion.css, html[data-tile=...]). The choice is kept in localStorage and applied before
 * first paint by THEME_INIT_SCRIPT as `data-tile` on <html>.
 */
export function TileStyleSwitch() {
  const [choice, setChoice] = useState<Tile>("flat");

  useEffect(() => {
    setChoice(current());
  }, []);

  function pick(next: Tile) {
    setChoice(next);
    const root = document.documentElement;
    if (next === "flat") root.removeAttribute("data-tile");
    else root.setAttribute("data-tile", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice lasts until the page is reloaded
    }
  }

  return (
    <div
      role="group"
      aria-label="Porównanie wyglądu kafli (tymczasowe)"
      className="fixed bottom-4 right-4 z-50 flex flex-wrap items-center gap-1 rounded-full border border-line-strong bg-surface p-1 shadow-pop"
    >
      <span className="pl-3 pr-1 text-caption text-ink-500">Kafel:</span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={choice === option.value}
          onClick={() => pick(option.value)}
          className={
            "min-h-9 rounded-full px-3 text-small font-semibold " +
            (choice === option.value ? "bg-action text-on-action" : "text-ink-700 hover:bg-sunken")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
