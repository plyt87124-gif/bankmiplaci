"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { ChevronUp, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AdminSwitchOption {
  key: "tester" | "own";
  label: string;
}

/**
 * Floating switch for the site owner (rendered only for a signed-in admin):
 * one click flips the visitor side of the site between the test account, the
 * owner's own account and "not signed in", and opens the admin panel. The
 * admin session itself never changes.
 */
export function AdminSwitcher({
  options,
  current
}: {
  options: AdminSwitchOption[];
  /** Which account the visitor session is right now: a key, or null (signed out / some other account). */
  current: AdminSwitchOption["key"] | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLabel = options.find((o) => o.key === current)?.label ?? "Niezalogowany";

  async function switchTo(account: AdminSwitchOption["key"] | "none") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Nie udało się przełączyć.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Nie udało się przełączyć.");
    } finally {
      setBusy(false);
    }
  }

  const item = "flex min-h-10 w-full items-center justify-between gap-3 rounded-field px-3 text-left text-small hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-500";

  return (
    <div className="fixed bottom-4 left-4 z-50 text-ui">
      {open ? (
        <div role="menu" className="mb-2 w-60 rounded-card border border-line bg-surface p-1.5 shadow-pop">
          <p className="px-3 py-1.5 text-caption text-ink-500">Strona jako użytkownik</p>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              role="menuitemradio"
              aria-checked={current === option.key}
              disabled={busy}
              onClick={() => switchTo(option.key)}
              className={cn(item, current === option.key && "font-semibold text-ink-900")}
            >
              {option.label}
              {current === option.key ? <span aria-hidden="true">●</span> : null}
            </button>
          ))}
          <button type="button" role="menuitem" disabled={busy} onClick={() => switchTo("none")} className={item}>
            Niezalogowany
            {current === null ? <span aria-hidden="true">●</span> : null}
          </button>
          <div className="my-1 border-t border-line" />
          <Link href="/admin" role="menuitem" className={item}>
            Panel admina
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className={cn(item, "text-coral-600")}
          >
            Wyloguj z panelu admina
          </button>
          {options.length === 0 ? (
            <p className="px-3 py-2 text-caption text-ink-500">
              Ustaw ADMIN_TEST_USER_EMAIL i ADMIN_OWN_USER_EMAIL w .env.local, by przełączać konta.
            </p>
          ) : null}
          {error ? <p className="px-3 py-2 text-caption text-coral-600">{error}</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-brand font-semibold text-ink-900 shadow-pop hover:bg-sunken"
      >
        <ShieldCheck size={16} aria-hidden="true" className="text-action" />
        Admin · {currentLabel}
        <ChevronUp size={16} aria-hidden="true" className={cn("transition-transform", open ? "" : "rotate-180")} />
      </button>
    </div>
  );
}
