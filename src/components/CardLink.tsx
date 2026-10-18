"use client";

import Link from "next/link";
import { useContext, type ComponentProps, type MouseEvent } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LAST_CARD_KEY, VT_CARD, canMorph, morphForward } from "@/lib/cardTransition";

/**
 * The offer name link of a card. A plain click on a browser that can do it
 * runs the navigation inside the "card turns into the page" transition;
 * ctrl/cmd/middle click, reduced motion or no View Transitions API leave the
 * link exactly as a normal link.
 */
export function CardLink({ slug, href, onClick, children, ...props }: ComponentProps<typeof Link> & { slug: string; href: string }) {
  const router = useContext(AppRouterContext);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const card = event.currentTarget.closest<HTMLElement>(`[data-vt="${VT_CARD}"]`);
    if (!router || !card || !canMorph()) return;
    event.preventDefault();
    try {
      sessionStorage.setItem(LAST_CARD_KEY, slug);
    } catch {
      // the Back animation just will not know the card; nothing else depends on it
    }
    morphForward(card, () => router.push(href));
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
