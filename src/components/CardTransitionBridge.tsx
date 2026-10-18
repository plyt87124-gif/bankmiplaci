"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { LAST_CARD_KEY, canMorph, morphBack } from "@/lib/cardTransition";

const OFFER_PATH = /^\/promocje\/([^/]+)\/?$/;

/**
 * Mounted once in the root layout: when the browser's Back button leaves an
 * offer page that was opened from a card, the page folds back into that card
 * (see lib/cardTransition.ts). Forward navigation is started by CardLink.
 */
export function CardTransitionBridge() {
  const pathname = usePathname();
  const current = useRef(pathname);

  useEffect(() => {
    current.current = pathname;
  }, [pathname]);

  useEffect(() => {
    function onPopState() {
      const match = OFFER_PATH.exec(current.current);
      if (!match || !canMorph()) return;
      let last: string | null = null;
      try {
        last = sessionStorage.getItem(LAST_CARD_KEY);
      } catch {
        last = null;
      }
      if (last && last === decodeURIComponent(match[1]!)) morphBack(last);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return null;
}
