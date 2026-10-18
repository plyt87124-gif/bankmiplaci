"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { LAST_CARD_KEY, VT_CARD, canMorph, morphForward } from "@/lib/cardTransition";

/**
 * The offer name link of a card. A plain click on a browser that can do it
 * starts the "card turns into the page" transition and then lets the link
 * navigate as it always does (the transition waits for the new page);
 * ctrl/cmd/middle click, reduced motion or no View Transitions API leave the
 * link exactly as a normal link.
 */
export function CardLink({ slug, href, onClick, children, ...props }: ComponentProps<typeof Link> & { slug: string; href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const card = event.currentTarget.closest<HTMLElement>(`[data-vt="${VT_CARD}"]`);
    if (!card || !canMorph()) return;
    try {
      sessionStorage.setItem(LAST_CARD_KEY, slug);
    } catch {
      // the Back animation just will not know the card; nothing else depends on it
    }
    morphForward(card);
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
