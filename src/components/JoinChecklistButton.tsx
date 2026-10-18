"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { useAuthModal } from "@/components/AuthModalProvider";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/cn";

// Today's calendar date in Poland (the clock the server validates against), not the
// UTC date: right after midnight in Poland the UTC date is still yesterday.
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());

export function JoinChecklistButton({
  promotionId,
  loggedIn,
  alreadyJoined,
  locked,
  bare = false
}: {
  promotionId: string;
  loggedIn: boolean;
  alreadyJoined: boolean;
  locked: boolean;
  /** Drawn inside another panel (the offer aside): no box of its own, smaller and quieter text. */
  bare?: boolean;
}) {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [joined, setJoined] = useState(alreadyJoined);
  const [loading, setLoading] = useState(false);
  const [accountOpenedAt, setAccountOpenedAt] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const baseId = useId();
  const dateId = `${baseId}-date`;
  const errorId = `${baseId}-error`;
  // Joining removes the button the visitor just pressed, so focus would fall back to <body>.
  // After a join made on this page it moves to the "Otwórz ściągę" link (not on first render
  // of an already-joined offer: nothing was pressed then and focus must not be stolen).
  const joinedHere = useRef(false);
  const openLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (joined && joinedHere.current) {
      joinedHere.current = false;
      openLinkRef.current?.focus();
    }
  }, [joined]);

  async function join() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/checklist/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionId, accountOpenedAt })
    }).catch(() => null);
    setLoading(false);
    if (res?.ok) {
      joinedHere.current = true;
      setJoined(true);
      router.push("/konto");
      return;
    }
    const data = res ? await res.json().catch(() => null) : null;
    setError(data?.error ?? "Nie udało się dodać ściągi. Spróbuj ponownie.");
  }

  function onButtonClick() {
    if (loggedIn) join();
    else openAuth({ mode: "login", onSuccess: join });
  }

  if (locked) {
    return (
      <div className={bare ? "" : "rounded-card border border-line bg-sunken p-5"}>
        <p className="flex items-start gap-2 text-ui font-semibold text-ink-900">
          <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
          Promocja ukończona
        </p>
        <p className="mt-1.5 text-small text-ink-700">
          Data zamknięcia konta jest już zapisana w historii bankowej w „Moje konto”. Gdy minie okres karencji dla
          tego banku, ściąga odblokuje się ponownie i będzie można skorzystać z kolejnej edycji tej promocji.
        </p>
      </div>
    );
  }

  return (
    <div className={bare ? "" : "rounded-card border border-line bg-surface p-5"} data-state={joined ? "joined" : undefined}>
      {/*
        One live region for the whole card, present from the first render and only filled
        later: a role="status" node inserted together with its text is often not announced.
      */}
      <div role="status" className="empty:hidden">
        {joined && (
          <p className="flex items-start gap-2 text-ui font-semibold text-ink-900">
            <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            Dodano do ściągi
          </p>
        )}
      </div>

      {joined ? (
        <>
          <p className="mt-1.5 text-small text-ink-700">Twoja szczegółowa ściąga czeka w „Moje konto”.</p>
          <Link ref={openLinkRef} href="/konto" className="link-inline mt-2 inline-flex min-h-11 items-center gap-1 text-ui font-medium">
            Otwórz ściągę
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </>
      ) : (
        <>
          <p className={cn("flex items-start gap-2 font-semibold text-ink-900", bare ? "text-small" : "text-ui")}>
            <ListChecks size={bare ? 16 : 20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
            Czy konto zostało już otwarte?
          </p>
          <p className={cn("mt-1 text-ink-700", bare ? "text-caption" : "text-small")}>
            Zbudujemy Ci ściągę w „Moje konto”: kroki rozpisane na miesiące, do odhaczania.
          </p>

          <div className={bare ? "mt-2.5" : "mt-4"}>
            <Label htmlFor={dateId}>Kiedy konto zostało otwarte?</Label>
            <Input
              id={dateId}
              type="date"
              value={accountOpenedAt}
              max={today()}
              onChange={(e) => setAccountOpenedAt(e.target.value)}
              invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          </div>

          <Button
            variant="secondary"
            fullWidth
            size={bare ? "sm" : "md"}
            className={bare ? "mt-2.5" : "mt-4"}
            onClick={onButtonClick}
            loading={loading}
            disabled={!accountOpenedAt}
          >
            {loading ? "Zapisywanie…" : loggedIn ? "Zapisz w ściądze" : "Zapisz w ściądze (wymaga konta)"}
          </Button>
          <FormMessage id={errorId}>{error}</FormMessage>
        </>
      )}
    </div>
  );
}
