"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "font";

type FontChoice = "inter" | "lexend";

function current(): FontChoice {
  try {
    return document.documentElement.getAttribute("data-font") === "lexend" ? "lexend" : "inter";
  } catch {
    return "inter";
  }
}

/**
 * TEMPORARY comparison switch (development builds only, see layout.tsx): body text in Inter (current) or in
 * Lexend (variant "Exo 2 + Lexend"). Headings, buttons, menu and amounts stay Exo 2 in both. The choice is kept in
 * localStorage and applied before first paint by THEME_INIT_SCRIPT as `data-font` on <html>.
 */
export function FontSwitch() {
  const [choice, setChoice] = useState<FontChoice>("inter");

  // Read the applied choice after hydration (the server cannot know it), so the first render matches the HTML.
  useEffect(() => {
    setChoice(current());
  }, []);

  function pick(next: FontChoice) {
    setChoice(next);
    const root = document.documentElement;
    if (next === "lexend") root.setAttribute("data-font", "lexend");
    else root.removeAttribute("data-font");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice lasts until the page is reloaded
    }
  }

  const option = (value: FontChoice, label: string) => (
    <button
      type="button"
      aria-pressed={choice === value}
      onClick={() => pick(value)}
      className={
        "min-h-9 rounded-full px-3 text-small font-semibold " +
        (choice === value ? "bg-action text-on-action" : "text-ink-700 hover:bg-sunken")
      }
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Porównanie czcionek tekstu (tymczasowe)"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-line-strong bg-surface p-1 shadow-pop"
    >
      <span className="pl-3 pr-1 text-caption text-ink-500">Tekst:</span>
      {option("inter", "Inter")}
      {option("lexend", "Lexend")}
    </div>
  );
}
