"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Label inside the <Link>: useLinkStatus only works in a CHILD of the link.
 * It reports the pending state up (for aria-busy, the live message and the
 * click guard) and swaps the text for "Ładuję…" with a spinner. The label
 * keeps its width reserved by the spinner so the button does not jump.
 */
function Label({ onPending }: { onPending: (pending: boolean) => void }) {
  const { pending } = useLinkStatus();
  useEffect(() => {
    onPending(pending);
  }, [pending, onPending]);
  return pending ? (
    <>
      <Loader2 size={16} aria-hidden="true" className="shrink-0 animate-spin" />
      Ładuję…
    </>
  ) : (
    <>Pokaż więcej</>
  );
}

/**
 * "Pokaż więcej" of /promocje. Still a plain crawlable link to `?strona=N`
 * (works without JavaScript); with JavaScript it shows that something is
 * happening while the next 24 offers load, ignores further clicks until they
 * arrived (they used to queue navigations) and announces the wait politely.
 * The link keeps the focus; when nothing is left the link goes away and
 * Filters moves the focus to the result counter.
 */
export function LoadMoreLink({ href, className }: { href: string; className?: string }) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const onPending = useCallback((next: boolean) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  return (
    <>
      <Link
        href={href}
        scroll={false}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        onClick={(event) => {
          if (pendingRef.current) event.preventDefault();
        }}
        className={cn(
          buttonClasses({ variant: "secondary", size: "md" }),
          pending ? "cursor-progress" : null,
          className
        )}
      >
        <Label onPending={onPending} />
      </Link>
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? "Ładuję kolejne promocje" : ""}
      </span>
    </>
  );
}
