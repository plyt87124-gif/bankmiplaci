"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { Menu, User, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { navAriaCurrent, type NavLink } from "@/lib/navigation";

/** Width from which the header shows the full navigation (Tailwind `lg`). */
const DESKTOP_QUERY = "(min-width: 1024px)";

export type MobileNavAccount = "user" | "guest" | "loading";

/**
 * Hamburger + dropdown menu of the header, below the `lg` breakpoint.
 *
 *  - The button is 44 x 44, `aria-expanded` + `aria-controls`; its name stays
 *    "Menu" (the state is announced by aria-expanded, not by renaming it).
 *  - Esc closes the menu and puts the focus back on the button; a click
 *    outside, tabbing out of it, following a link and widening the window to
 *    desktop size close it too.
 *  - The panel is always in the DOM and opens by animating `grid-template-rows`
 *    (0fr to 1fr, 200 ms, the technique of .collapse-rows in motion.css); while
 *    closed it is `inert`, so its links leave the tab order and the
 *    accessibility tree.
 *  - The panel is absolutely positioned against the <header> (the nearest
 *    positioned ancestor), so it overlays the page instead of pushing it down.
 *
 * The sign-in dialog is opened by the parent (`onLogin`), which keeps this
 * component free of the auth context.
 */
export function MobileNav({
  links,
  pathname,
  account,
  onLogin
}: {
  links: readonly NavLink[];
  pathname: string | null;
  account: MobileNavAccount;
  onLogin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A page change (also back/forward) always leaves the menu closed.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The menu only exists below lg: growing the window closes it.
  useEffect(() => {
    let query: MediaQueryList;
    try {
      query = window.matchMedia(DESKTOP_QUERY);
    } catch {
      return;
    }
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Esc and a click outside close it - only while it is open.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  // Tabbing past the last entry (or shift-tabbing out of the first) leaves the
  // menu open over the page: close it. A null relatedTarget (a click on
  // a non-focusable spot, the window losing focus) is left to the other handlers.
  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (open && next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
  }

  function login() {
    // The sign-in dialog hands the focus back to whoever had it when it opened.
    // The menu is about to become inert, so that must be the button, not the
    // "Zaloguj się" entry inside the closing panel.
    buttonRef.current?.focus();
    setOpen(false);
    onLogin();
  }

  const itemClasses = "flex min-h-12 w-full items-center rounded-field px-3 text-ui font-medium";

  return (
    <div ref={rootRef} className="lg:hidden" onBlur={closeWhenFocusLeaves}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field text-ink-700 transition-colors duration-150 ease-out hover:bg-ink-100"
      >
        {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
      </button>

      {/* The same technique as `.collapse-rows` in motion.css, written with Tailwind utilities here. (The
          shared class used to be called `.collapse`, which clashed with Tailwind's own `collapse`
          utility, visibility: collapse, and would hide the open panel.) */}
      <div
        data-open={open}
        className="absolute inset-x-0 top-full grid grid-rows-[0fr] transition-[grid-template-rows] duration-base ease-out data-[open=true]:grid-rows-[1fr]"
      >
        <div id={panelId} inert={!open} className="min-h-0 overflow-hidden">
          <nav aria-label="Menu mobilne" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-y border-line bg-paper">
            <div className="container-page flex flex-col gap-1 py-3">
              {links.map((link) => {
                const current = navAriaCurrent(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={current}
                    onClick={close}
                    className={cn(
                      itemClasses,
                      current ? "bg-teal-100 text-teal-700" : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {account !== "loading" ? (
                <div className="mt-2 border-t border-line pt-3">
                  {account === "user" ? (
                    <ButtonLink href="/konto" variant="secondary" fullWidth onClick={close}>
                      <User size={20} aria-hidden="true" />
                      Moje konto
                    </ButtonLink>
                  ) : (
                    <Button variant="secondary" fullWidth onClick={login}>
                      <User size={20} aria-hidden="true" />
                      Zaloguj się
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
