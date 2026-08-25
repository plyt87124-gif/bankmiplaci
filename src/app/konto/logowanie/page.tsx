"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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

    router.push(searchParams.get("redirect") ?? "/konto");
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="w-full max-w-sm rounded-xl2 border border-ink-100 bg-surface p-8 shadow-card">
        <h1 className="text-xl font-semibold">Zaloguj się</h1>
        <p className="mt-1 text-sm text-ink-500">Zaloguj się, aby komentować promocje i zapisywać swoją historię bankową.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="identifier" className="text-sm font-medium text-ink-700">E-mail lub nazwa użytkownika</label>
            <input id="identifier" name="identifier" required className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500" />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-ink-700">Hasło</label>
            <input id="password" name="password" type="password" required className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500" />
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button disabled={loading} className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
            {loading ? "Logowanie..." : "Zaloguj się"}
          </button>
        </form>

        <div className="mt-5 flex justify-between text-sm">
          <Link href="/konto/zapomniane-haslo" className="text-teal-700 hover:underline">Nie pamiętam hasła</Link>
          <Link
            href={`/konto/rejestracja${searchParams.get("redirect") ? `?redirect=${encodeURIComponent(searchParams.get("redirect")!)}` : ""}`}
            className="text-teal-700 hover:underline"
          >
            Załóż konto
          </Link>
        </div>
      </div>
    </div>
  );
}
