"use client";

import { useEffect, useState } from "react";
import { AffiliateCtaLink } from "@/components/AffiliateCtaLink";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { cn } from "@/lib/cn";
import type { FactTone } from "./offerModel";

const TONE_CLASS: Record<FactTone, string> = {
  neutral: "text-ink-500",
  warn: "text-warn",
  danger: "text-coral-600"
};

/** Bottom padding the page gets while the bar covers the viewport edge (so a focused element is scrolled above it). */
const BAR_SCROLL_PADDING = "8rem";

/**
 * Sticky call-to-action bar for phones and small tablets (hidden from lg).
 *
 * It slides up (200 ms, `.slide-up-bar` in motion.css) while the page's main
 * CTA is NOT in the viewport, and slides away again when the reader reaches the
 * comments (the closing CTA and the footer need the whole screen). Both are
 * position reads of elements that already exist in the page, taken once per
 * animation frame while the page scrolls (passive listener, no layout writes).
 *
 * Everything the law and the design spec require of a button to a bank is here
 * too: the compact affiliate disclosure DIRECTLY under the button, the same
 * tracked /out/... link (own `src`), and the standard rel/target of
 * AffiliateCtaLink. The link is a plain anchor: it never waits for the
 * animation. While the bar is hidden it is `inert` (not focusable, not read).
 *
 * The server renders it hidden (SSR and the first client render match); the bar
 * is only rendered for offers that are open and have a live partner link.
 */
export function MobileCtaBar({
  href,
  amountText,
  termText,
  termTone,
  mainCtaId,
  endMarkerId
}: {
  /** /out/{slug}?src=detail-cta-sticky */
  href: string;
  /** "Premia do 800 zł" / "Bez premii gotówkowej". */
  amountText: string;
  /** "Koniec za 4 dni" / "do 31.10.2026". */
  termText: string;
  termTone: FactTone;
  /** id of the main call-to-action link (the aside's). */
  mainCtaId: string;
  /** id of the element where the comments begin. */
  endMarkerId: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.getElementById(mainCtaId);
    if (!main) return;
    const end = document.getElementById(endMarkerId);

    // The state is re-read from the elements' real positions on every scroll
    // frame, not accumulated from IntersectionObserver events: an observer does
    // not fire when the reader JUMPS (Home / End, "back to top", an anchor link)
    // over an element, and the bar then stayed hidden after the jump.
    let frame = 0;
    const compute = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const mainRect = main.getBoundingClientRect();
      const mainOut = mainRect.bottom <= 0 || mainRect.top >= viewport;
      // "Reached" = the comments' top edge is on screen or already above it.
      const endReached = end ? end.getBoundingClientRect().top < viewport : false;
      setVisible(mainOut && !endReached);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [mainCtaId, endMarkerId]);

  // While the bar is up, keyboard focus is scrolled clear of it (WCAG 2.4.11).
  useEffect(() => {
    if (!visible) return;
    let narrow = false;
    try {
      narrow = window.matchMedia("(max-width: 1023px)").matches;
    } catch {
      narrow = false;
    }
    if (!narrow) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = BAR_SCROLL_PADDING;
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [visible]);

  return (
    <div
      role="region"
      aria-label="Szybkie przejście do promocji"
      data-visible={visible ? "true" : "false"}
      data-sticky-cta=""
      inert={!visible}
      className="slide-up-bar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface shadow-modal data-[visible=false]:invisible lg:hidden"
    >
      <div className="container-page pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5">
        {/* One row from ~340 px up; on a narrower phone the text takes a row of its own and the button
            the full width below it, so neither is squeezed into breaking a number across lines. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 flex-[1_1_6.25rem]">
            <p className="whitespace-nowrap text-small font-semibold text-ink-900">{amountText}</p>
            <p className={cn("text-caption", TONE_CLASS[termTone])}>{termText}</p>
          </div>
          <AffiliateCtaLink href={href} size="md" className="flex-[1_0_auto] px-4">
            Przejdź do promocji
          </AffiliateCtaLink>
        </div>
        <AffiliateDisclosure variant="compact" className="mt-1.5 text-caption" />
      </div>
    </div>
  );
}
