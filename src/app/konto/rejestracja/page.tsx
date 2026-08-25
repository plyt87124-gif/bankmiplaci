"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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

    // A redirect param means they were sent here from somewhere specific
    // (e.g. a promotion page) — honor that instead of the default
    // onboarding step, which only makes sense for an organic signup.
    const redirect = searchParams.get("redirect");
    router.push(redirect ?? "/konto?onboarding=1");
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="w-full max-w-sm rounded-xl2 border border-ink-100 bg-surface p-8 shadow-card">
        <h1 className="text-xl font-semibold">Załóż konto</h1>
        <p className="mt-1 text-sm text-ink-500">Darmowe konto pozwala komentować promocje i śledzić okresy karencji.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="name" className="text-sm font-medium text-ink-700">Imię (opcjonalnie)</label>
            <input id="name" name="name" className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500" />
          </div>
          <div>
            <label htmlFor="username" className="text-sm font-medium text-ink-700">Nazwa użytkownika</label>
            <input id="username" name="username" required minLength={3} maxLength={20} placeholder="np. jan_kowalski" className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500" />
            <p className="mt-1 text-xs text-ink-300">Będziesz mógł/mogła zalogować się tą nazwą zamiast e-mailem.</p>
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-ink-700">E-mail</label>
            <input id="email" name="email" type="email" required className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500" />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-ink-700">Hasło (min. 8 znaków)</label>
            <input id="password" name="password" type="password" required minLength={8} className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500" />
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button disabled={loading} className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
            {loading ? "Tworzenie konta..." : "Załóż konto"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-500">
          Masz już konto?{" "}
          <Link
            href={`/konto/logowanie${searchParams.get("redirect") ? `?redirect=${encodeURIComponent(searchParams.get("redirect")!)}` : ""}`}
            className="text-teal-700 hover:underline"
          >
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  );
}
