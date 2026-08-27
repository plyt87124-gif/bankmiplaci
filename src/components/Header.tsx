"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowRight, User } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuthModal } from "@/components/AuthModalProvider";

const NAV = [
  { href: "/porownaj", label: "Porównaj konta" },
  { href: "/promocje?difficulty=VERY_EASY,EASY&sort=easiest", label: "Najłatwiejsze promocje" },
  { href: "/faq", label: "FAQ" }
];

interface HeaderUser {
  id: string;
  email: string;
  name: string | null;
}

export function Header({ user }: { user: HeaderUser | null }) {
  const [open, setOpen] = useState(false);
  const { openAuth } = useAuthModal();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-paper/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink-900">
          Bankmiplaci
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-ink-700 hover:text-ink-900">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {user ? (
            <Link href="/konto" className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-ink-900">
              <User className="h-4 w-4" />
              {user.name || "Moje konto"}
            </Link>
          ) : (
            <button
              onClick={() => openAuth({ mode: "login" })}
              className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-ink-900"
            >
              <User className="h-4 w-4" />
              Zaloguj się
            </button>
          )}
          <ThemeToggle />
          <ButtonLink href="/promocje" size="sm">
            Znajdź promocję <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>

        <ThemeToggle className="md:hidden" />
        <button
          className="rounded-md p-2 text-ink-700 md:hidden"
          aria-label={open ? "Zamknij menu" : "Otwórz menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-100 bg-paper md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-medium text-ink-700 hover:bg-ink-100"
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <Link
                href="/konto"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-medium text-ink-700 hover:bg-ink-100"
              >
                {user.name || "Moje konto"}
              </Link>
            ) : (
              <button
                onClick={() => {
                  setOpen(false);
                  openAuth({ mode: "login" });
                }}
                className="rounded-lg px-2 py-3 text-left text-base font-medium text-ink-700 hover:bg-ink-100"
              >
                Zaloguj się
              </button>
            )}
            <ButtonLink href="/promocje" className="mt-2 w-full" onClick={() => setOpen(false)}>
              Znajdź promocję
            </ButtonLink>
          </nav>
        </div>
      )}
    </header>
  );
}
