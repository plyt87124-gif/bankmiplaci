"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SessionProvider, useOptionalSession, useSession } from "@/components/SessionProvider";
import { LoginForm } from "@/app/konto/logowanie/LoginForm";
import { RegisterForm } from "@/app/konto/rejestracja/RegisterForm";
import {
  AUTH_INTROS,
  AUTH_TITLES,
  createBackdropCloseTracker,
  isOutsideRect,
  type AuthMode
} from "@/app/konto/logowanie/authFlow";

export type { AuthMode };

interface OpenOptions {
  mode?: AuthMode;
  onSuccess?: () => void;
}

interface AuthModalContextValue {
  openAuth: (options?: OpenOptions) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

type CloseOptions = {
  /** Give the focus back to the element that opened the dialog (default). Off when the dialog closes because the page is navigating away. */
  restoreFocus?: boolean;
};

/**
 * Site-wide sign-in / sign-up dialog (opened through `useAuthModal().openAuth`).
 *
 * `user` is the server's answer from the root layout (getCurrentUser); it
 * seeds the SessionProvider this component mounts, unless a SessionProvider
 * already exists higher up. Omit it (WP-17) and the session is fetched from
 * /api/account/me instead.
 */
export function AuthModalProvider({
  children,
  user
}: {
  children: ReactNode;
  user?: { id: string; name: string | null } | null;
}) {
  const hasSession = useOptionalSession() !== null;
  const inner = <AuthModalInner>{children}</AuthModalInner>;
  return hasSession ? inner : <SessionProvider initialUser={user}>{inner}</SessionProvider>;
}

function AuthModalInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const onSuccessRef = useRef<(() => void) | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const focusTargetRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const [isRefreshing, startRefresh] = useTransition();
  const focusMainAfterRefresh = useRef(false);

  const openAuth = useCallback((options?: OpenOptions) => {
    setMode(options?.mode ?? "login");
    onSuccessRef.current = options?.onSuccess ?? null;
    if (!openRef.current) {
      // Remember who opened it, to give them the focus back on close.
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      openRef.current = true;
    }
    setOpen(true);
  }, []);

  const close = useCallback(({ restoreFocus = true }: CloseOptions = {}) => {
    if (!openRef.current) return; // already closed (the native `close` event follows our own close)
    openRef.current = false;
    focusTargetRef.current = restoreFocus ? openerRef.current : null;
    openerRef.current = null;
    setOpen(false);
  }, []);

  // Runs after the dialog has left the DOM (an inert/hidden opener cannot take
  // focus before that): hand the focus back to whoever opened it.
  useEffect(() => {
    if (open) return;
    const target = focusTargetRef.current;
    focusTargetRef.current = null;
    if (target?.isConnected) target.focus();
  }, [open]);

  const handleSuccess = useCallback(() => {
    close();
    void session.refresh();
    // router.refresh() re-renders the layout (header, page) for the new user.
    // Inside a transition so we know when it ends and can fix the focus if the
    // element that had it (e.g. the header's "Zaloguj się") was swapped out.
    focusMainAfterRefresh.current = true;
    startRefresh(() => router.refresh());
    onSuccessRef.current?.();
  }, [close, router, session]);

  useEffect(() => {
    if (isRefreshing || !focusMainAfterRefresh.current) return;
    focusMainAfterRefresh.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      document.getElementById("tresc")?.focus({ preventScroll: true });
    }
  }, [isRefreshing]);

  const api = useMemo<AuthModalContextValue>(() => ({ openAuth }), [openAuth]);

  return (
    <AuthModalContext.Provider value={api}>
      {children}
      {open ? <AuthDialog mode={mode} onModeChange={setMode} onClose={close} onSuccess={handleSuccess} /> : null}
    </AuthModalContext.Provider>
  );
}

/** Stops the page behind the modal from scrolling (without a layout jump when the scrollbar disappears). */
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

function AuthDialog({
  mode,
  onModeChange,
  onClose,
  onSuccess
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: (options?: CloseOptions) => void;
  onSuccess: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const backdrop = useRef(createBackdropCloseTracker());
  const titleId = useId();
  const introId = useId();

  // Native modal: the browser traps Tab inside, makes the rest of the page
  // inert, handles Esc and draws ::backdrop. (No close() on cleanup: when the
  // dialog unmounts the node leaves the DOM and with it the top layer; and in
  // development StrictMode re-runs effects on the same, still open, node.)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return lockPageScroll();
  }, []);

  // First field gets the focus when the dialog opens and after switching
  // between sign-in and sign-up (the control that was clicked disappears).
  // Declared after the effect above, so the dialog is already open.
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [mode]);

  function pressedOnBackdrop(e: MouseEvent<HTMLDialogElement>) {
    // Clicks on the ::backdrop are dispatched to the <dialog> itself; the
    // rectangle test separates them from clicks on its own padding.
    return (
      e.target === e.currentTarget &&
      isOutsideRect({ x: e.clientX, y: e.clientY }, e.currentTarget.getBoundingClientRect())
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={introId}
      onCancel={(e) => {
        // Esc: close through our state so there is one source of truth.
        e.preventDefault();
        onClose();
      }}
      onClose={(e) => {
        // Closed by the browser without a cancel event (a second Esc). Ignore
        // the stale event StrictMode's simulated remount can leave behind.
        if (!e.currentTarget.open) onClose();
      }}
      onMouseDown={(e) => backdrop.current.down(pressedOnBackdrop(e))}
      onMouseUp={(e) => {
        if (backdrop.current.up(pressedOnBackdrop(e))) onClose();
      }}
      className="animate-dialog-in m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[27.5rem] scroll-pt-20 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-0 text-ink-900 shadow-modal"
    >
      {/* The title row sticks to the top while a tall form scrolls (small phones), so the X is always reachable. */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-surface px-6 pb-2 pt-6 sm:px-8 sm:pt-8">
        <h2 id={titleId} className="font-display text-h2">
          {AUTH_TITLES[mode]}
        </h2>
        <Button
          variant="ghost"
          aria-label="Zamknij"
          onClick={() => onClose()}
          className="-mr-3 -mt-2 h-11 w-11 shrink-0 px-0"
        >
          <X size={24} aria-hidden="true" />
        </Button>
      </div>
      <div className="px-6 pb-6 sm:px-8 sm:pb-8">
        <p id={introId} className="text-small text-ink-700">
          {AUTH_INTROS[mode]}
        </p>

        <div className="mt-6">
          {mode === "login" ? (
            <>
              <LoginForm key="login" firstFieldRef={firstFieldRef} onSuccess={onSuccess} />
              <Link
                href="/konto/zapomniane-haslo"
                onClick={() => onClose({ restoreFocus: false })}
                className="link-inline mt-2 inline-flex min-h-11 items-center text-small"
              >
                Nie pamiętam hasła
              </Link>
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-3 text-small text-ink-700">Nie masz jeszcze konta?</p>
                <Button variant="secondary" fullWidth onClick={() => onModeChange("register")}>
                  Załóż darmowe konto
                </Button>
              </div>
            </>
          ) : (
            <>
              <RegisterForm key="register" firstFieldRef={firstFieldRef} onSuccess={onSuccess} />
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-3 text-small text-ink-700">Masz już konto?</p>
                <Button variant="secondary" fullWidth onClick={() => onModeChange("login")}>
                  Zaloguj się
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
