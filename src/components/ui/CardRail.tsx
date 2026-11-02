"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A short list of offer cards that becomes a swipeable row on a phone.
 *
 * Below `sm` (a phone) the cards sit in one row that scrolls sideways with a
 * finger and snaps to the centre of the screen. Each card is 80% of the screen
 * wide (22 rem at most), so the neighbours stay visible at both edges: that
 * sliver is the whole "you can swipe here" signal, and a row of dots under the
 * row says where you are. The row runs edge to edge (`-mx-4` cancels the 1 rem
 * page gutter), so it must sit directly in a `container-page` column.
 *
 * From `sm` up nothing changes: the same 2 / 3 column grid as before, no dots.
 *
 * The children are the `<li>` items (server-rendered cards handed in as ready
 * nodes); this island only watches the scroll position for the dots. The dots
 * are decoration (aria-hidden): the row is a plain list, every card is a
 * normal link, and focusing a card scrolls it into view.
 */
export function CardRail({
  columns = 3,
  className,
  children
}: {
  /** Columns from `lg` up (`sm` is always 2). */
  columns?: 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);
  const swipeable = count > 1;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const items = Array.from(list.children).filter((child): child is HTMLElement => child.tagName === "LI");
      if (items.length === 0) return;
      const middle = list.scrollLeft + list.clientWidth / 2;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      items.forEach((item, i) => {
        const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle);
        if (distance < bestDistance) {
          best = i;
          bestDistance = distance;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      list.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={className}>
      <ul
        ref={listRef}
        role="list"
        className={cn(
          // one card has nothing to swipe to: it stays a full-width card on a phone too
          swipeable
            ? [
                // phone: one row, snaps to the centre, neighbours peek out on both sides
                "relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                // empty ends: they let the first and the last card reach the centre of the screen
                "before:w-[calc((100vw-min(80vw,22rem))/2-0.75rem)] before:shrink-0 before:content-[''] after:w-[calc((100vw-min(80vw,22rem))/2-0.75rem)] after:shrink-0 after:content-['']",
                "[&>li]:w-[min(80vw,22rem)] [&>li]:shrink-0 [&>li]:snap-center",
                // sm and up: the grid we always had
                "sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:pb-0 sm:before:hidden sm:after:hidden sm:[&>li]:w-auto sm:[&>li]:shrink"
              ]
            : "grid",
          "gap-4 sm:grid-cols-2 lg:gap-6",
          swipeable && "max-sm:gap-3",
          columns === 3 && "lg:grid-cols-3"
        )}
      >
        {children}
      </ul>

      {swipeable ? (
        <div aria-hidden="true" data-rail-dots="" className="mt-3 flex items-center justify-center gap-1.5 sm:hidden">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              data-active={i === active ? "true" : undefined}
              className={cn(
                "block h-2 rounded-full transition-[width,background-color] duration-base ease-out motion-reduce:transition-none",
                i === active ? "w-5 bg-action" : "w-2 bg-line-strong"
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
