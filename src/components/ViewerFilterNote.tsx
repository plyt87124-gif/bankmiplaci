"use client";

import Link from "next/link";
import { useViewerFilter } from "@/components/BlockedOffers";

/**
 * Under (or above) an offer list: tells a signed-in visitor who turned on "Pokazuj tylko oferty, w których mogę
 * wziąć udział" that the list is filtered and why. Renders nothing for everyone else (and until the setting is known).
 */
export function ViewerFilterNote({ className }: { className?: string }) {
  const { onlyEligible, count } = useViewerFilter();
  if (!onlyEligible) return null;
  return (
    <p data-viewer-filter="on" className={className ?? "mt-4 text-small text-ink-500"}>
      Masz włączony filtr „tylko oferty, w których mogę wziąć udział”, więc widzisz tylko takie promocje
      {count > 0 ? ` (ukryliśmy ${count})` : ""}. Wyłączysz go w{" "}
      <Link href="/konto#ustawienia" className="link-inline font-medium">
        Moje konto
      </Link>
      .
    </p>
  );
}
