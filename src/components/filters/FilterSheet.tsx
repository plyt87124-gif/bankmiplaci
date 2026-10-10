"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createBackdropCloseTracker, isOutsideRect } from "@/app/konto/logowanie/authFlow";

/** Stops the page behind a modal from scrolling, without a layout jump when the scrollbar disappears. */
function lockPageScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const previous = { overflow: html.style.overflow, paddingRight: body.style.paddingRight };
  const scrollbar = window.innerWidth - html.clientWidth;
  html.style.overflow = "hidden";
  if (scrollbar > 0) {
    const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbar}px`;
  }
  return () => {
    html.style.overflow = previous.overflow;
    body.style.paddingRight = previous.paddingRight;
  };
}

/**
 * Bottom sheet for the filters on screens below xl: a native modal <dialog>
 * (focus trap, inert page, Esc and the backdrop come from the browser). It is
 * always in the DOM; `open` calls showModal() / close(). The browser gives the
 * focus back to the button that opened it.
 *
 * The title row stays at the top and the action row at the bottom while the
 * fields scroll. A click counts as "on the backdrop" only when both the press
 * and the release happened there (selecting text must not close the sheet).
 */
export function FilterSheet({
  open,
  onClose,
  title,
  footer,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdrop = useRef(createBackdropCloseTracker());
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  function pressedOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    // Clicks on ::backdrop are dispatched to the <dialog> itself; the rectangle
    // test tells them from clicks on the dialog's own padding.
    return (
      event.target === event.currentTarget &&
      isOutsideRect({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect())
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- natywny <dialog>: mouse down/up tylko wykrywa klik w tlo (backdrop); zamykanie z klawiatury (Esc) obsluguje przegladarka (onClose).
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onMouseDown={(event) => backdrop.current.down(pressedOnBackdrop(event))}
      onMouseUp={(event) => {
        if (backdrop.current.up(pressedOnBackdrop(event))) onClose();
      }}
      className="animate-dialog-in fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none overflow-hidden rounded-b-none rounded-t-2xl border border-b-0 border-line bg-surface p-0 text-ink-900 shadow-modal sm:mx-auto sm:max-w-[32rem]"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-2 sm:px-6">
          <h2 id={titleId} className="font-body text-h3">
            {title}
          </h2>
          <Button variant="ghost" aria-label="Zamknij filtry" onClick={onClose} className="-mr-3 h-11 w-11 shrink-0 px-0">
            <X size={24} aria-hidden="true" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {footer}
        </div>
      </div>
    </dialog>
  );
}
