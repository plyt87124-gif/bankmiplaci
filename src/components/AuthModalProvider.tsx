"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";

type AuthMode = "login" | "register";

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

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const onSuccessRef = useRef<(() => void) | null>(null);

  const openAuth = useCallback((options?: OpenOptions) => {
    setMode(options?.mode ?? "login");
    onSuccessRef.current = options?.onSuccess ?? null;
    setOpen(true);
  }, []);

  function close() {
    setOpen(false);
  }

  function handleSuccess() {
    setOpen(false);
    router.refresh();
    onSuccessRef.current?.();
  }

  return (
    <AuthModalContext.Provider value={{ openAuth }}>
      {children}
      <AuthModal open={open} mode={mode} onModeChange={setMode} onClose={close} onSuccess={handleSuccess} />
    </AuthModalContext.Provider>
  );
}

function AuthModal({
  open,
  mode,
  onModeChange,
  onClose,
  onSuccess
}: {
  open: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    firstFieldRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, mode]);

  if (!open) return null;

  async function onLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/account/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: form.get("identifier"), password: form.get("password") })
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Nie udało się zalogować.");
      return;
    }
    onSuccess();
  }

  async function onRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    if (String(form.get("password")).length < 8) {
      setError("Hasło musi mieć min. 8 znaków.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/account/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        username: form.get("username"),
        password: form.get("password"),
        name: form.get("name")
      })
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Nie udało się założyć konta.");
      return;
    }
    onSuccess();
  }

  return (
    <div
      // A fixed, theme-independent dark tint — using a token like ink-900
      // (which flips to near-white in dark mode) here washed the backdrop
      // out to a pale haze instead of dimming the page.
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "login" ? "Zaloguj się" : "Załóż konto"}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl2 border border-ink-100 bg-surface p-8 shadow-cardHover"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold text-ink-900">{mode === "login" ? "Zaloguj się" : "Załóż konto"}</h2>
          <button onClick={onClose} aria-label="Zamknij" className="text-ink-300 hover:text-ink-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mode === "login" ? (
          <>
            <p className="mt-1 text-sm text-ink-500">Zaloguj się, żeby dokończyć — zostaniesz tu, gdzie byłeś/aś.</p>
            <form className="mt-6 space-y-4" onSubmit={onLoginSubmit}>
              <div>
                <label htmlFor="modal-identifier" className="text-sm font-medium text-ink-700">
                  E-mail lub nazwa użytkownika
                </label>
                <input
                  ref={firstFieldRef}
                  id="modal-identifier"
                  name="identifier"
                  required
                  className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label htmlFor="modal-password" className="text-sm font-medium text-ink-700">
                  Hasło
                </label>
                <input
                  id="modal-password"
                  name="password"
                  type="password"
                  required
                  className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500"
                />
              </div>
              {error && <p className="text-sm text-coral-600">{error}</p>}
              <button
                disabled={loading}
                className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? "Logowanie..." : "Zaloguj się"}
              </button>
            </form>
            <div className="mt-5 flex items-center justify-between text-sm">
              <Link href="/konto/zapomniane-haslo" onClick={onClose} className="text-teal-700 hover:underline">
                Nie pamiętam hasła
              </Link>
              <button onClick={() => onModeChange("register")} className="text-teal-700 hover:underline">
                Załóż darmowe konto
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-500">Darmowe konto pozwala komentować promocje i śledzić okresy karencji.</p>
            <form className="mt-6 space-y-4" onSubmit={onRegisterSubmit}>
              <div>
                <label htmlFor="modal-name" className="text-sm font-medium text-ink-700">
                  Imię (opcjonalnie)
                </label>
                <input
                  ref={firstFieldRef}
                  id="modal-name"
                  name="name"
                  className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label htmlFor="modal-username" className="text-sm font-medium text-ink-700">
                  Nazwa użytkownika
                </label>
                <input
                  id="modal-username"
                  name="username"
                  required
                  minLength={3}
                  maxLength={20}
                  placeholder="np. jan_kowalski"
                  className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label htmlFor="modal-email" className="text-sm font-medium text-ink-700">
                  E-mail
                </label>
                <input
                  id="modal-email"
                  name="email"
                  type="email"
                  required
                  className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label htmlFor="modal-reg-password" className="text-sm font-medium text-ink-700">
                  Hasło (min. 8 znaków)
                </label>
                <input
                  id="modal-reg-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500"
                />
              </div>
              {error && <p className="text-sm text-coral-600">{error}</p>}
              <button
                disabled={loading}
                className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? "Tworzenie konta..." : "Załóż konto"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-ink-500">
              Masz już konto?{" "}
              <button onClick={() => onModeChange("login")} className="text-teal-700 hover:underline">
                Zaloguj się
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
