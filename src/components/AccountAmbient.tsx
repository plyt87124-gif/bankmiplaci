"use client";

import { useEffect, useState } from "react";
import { AMBIENT_START } from "@/lib/accountAmbient";

/**
 * /konto: the page background changes hue a little with the part of the page
 * the user is looking at (the ściąga of one bank, the next one, the settings,
 * the bank history).
 *
 * Every part that has its own content carries `data-ambient-tone="<name>"`
 * (src/lib/accountAmbient.ts). A thin band across the middle of the screen is
 * watched with an IntersectionObserver (no scroll listener): the part that
 * crosses it sets the tone. Between two parts the last tone stays. The tone is
 * written to `<body data-konto-tone>`; the colour itself is CSS (globals.css):
 * the paper colour mixed with one accent at a few per cent, shown by a fixed
 * layer behind the page and by the sticky header, eased over about a second and
 * not animated at all for people who asked for reduced motion. The attribute is
 * removed when the page is left, so no other page keeps the tint.
 *
 * Without IntersectionObserver the page simply keeps the plain background.
 */
export function AccountAmbient() {
  const [tone, setTone] = useState(AMBIENT_START);

  useEffect(() => {
    document.body.dataset.kontoTone = tone;
  }, [tone]);
  useEffect(() => () => document.body.removeAttribute("data-konto-tone"), []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-ambient-tone]"));
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Only the entries that CHANGED arrive; the last one that is crossing the band wins.
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const next = (entry.target as HTMLElement).dataset.ambientTone;
          if (next) setTone(next);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return <div aria-hidden="true" data-tone={tone} className="konto-ambient" />;
}
