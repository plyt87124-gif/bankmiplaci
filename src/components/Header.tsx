"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav, type MobileNavAccount } from "@/components/MobileNav";
import { useAuthModal } from "@/components/AuthModalProvider";
import { useSession } from "@/components/SessionProvider";
import { cn } from "@/lib/cn";
import { getMainNav, navAriaCurrent } from "@/lib/navigation";

/**
 * Site header (docs/redesign-v2/01-design-spec.md, section 5).
 *
 *  - Sticky, 56 px (mobile) / 64 px. The bottom border is transparent at the
 *    top of the page and becomes `line` once the page has scrolled: a 1 px
 *    sentinel at the very top is watched by an IntersectionObserver (no scroll
 *    listener), the border change takes 200 ms. No blur, the logo never shrinks.
 *  - From lg: wordmark, `Promocje - Porownaj - Quiz - Poradniki - Jak to dziala`
 *    (the current page has `aria-current` and an underline), then the account
 *    entry and the theme switch. Below lg: wordmark, theme switch and the
 *    hamburger (MobileNav).
 *  - The signed-in user comes from the session context (`useSession`), so the
 *    header follows a sign-in/out without a page reload. The sign-in dialog is
 *    still opened with `openAuth({ mode: "login" })`.
 *  - Links come from src/lib/navigation.ts: pages that are not live yet do not
 *    appear. There is deliberately no "Znajdz promocje" button: it duplicated
 *    "Promocje".
 *  - The lifetime earnings counter is not mounted here: its number only exists
 *    inside the checklist on /konto (EarningsProvider), where it stays.
 */
export function Header() {
  const { user, status } = useSession();
  const { openAuth } = useAuthModal();
  const pathname = usePathname();
  const links = getMainNav();

  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const latest = entries[entries.length - 1];
      if (latest) setScrolled(!latest.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const account: MobileNavAccount = status === "loading" ? "loading" : user ? "user" : "guest";
  const login = () => openAuth({ mode: "login" });

  return (
    <>
      {/* Page-top marker for the scroll border; out of flow, so it takes no space. */}
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-px w-px" />
      <header
        data-scrolled={scrolled ? "true" : "false"}
        className={cn(
          "sticky top-0 z-40 border-b bg-paper/95 transition-[border-color] duration-base ease-out",
          scrolled ? "border-line" : "border-transparent"
        )}
      >
        <div className="container-page flex h-14 items-center gap-4 sm:h-16">
          <div className="flex min-w-0 items-center gap-6 xl:gap-10">
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className="-mx-1 inline-flex min-h-11 items-center rounded-field px-1"
            >
              <Logo height={26} />
            </Link>

            <nav aria-label="Menu główne" className="hidden items-center gap-1 lg:flex">
              {links.map((link) => {
                const current = navAriaCurrent(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={current}
                    className={cn(
                      "relative inline-flex min-h-11 items-center whitespace-nowrap px-3 text-ui font-medium transition-colors duration-150 ease-out",
                      current ? "text-ink-900" : "text-ink-700 hover:text-ink-900"
                    )}
                  >
                    {link.label}
                    {current ? (
                      <span aria-hidden="true" className="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-action" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <div className="hidden lg:block">
              {status === "loading" ? (
                // Same footprint as the real entry, so nothing shifts when the session arrives.
                <span aria-hidden="true" className="inline-block h-11 w-32" />
              ) : user ? (
                <ButtonLink href="/konto" variant="ghost">
                  <User size={20} aria-hidden="true" />
                  Moje konto
                </ButtonLink>
              ) : (
                <Button variant="ghost" onClick={login}>
                  <User size={20} aria-hidden="true" />
                  Zaloguj się
                </Button>
              )}
            </div>

            <ThemeToggle />
            <MobileNav links={links} pathname={pathname} account={account} onLogin={login} />
          </div>
        </div>
      </header>
    </>
  );
}
