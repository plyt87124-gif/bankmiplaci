"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));

    if (password.length < 8) {
      setError("Hasło musi mieć min. 8 znaków.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/account/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Nie udało się zresetować hasła.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/konto/logowanie"), 2000);
  }

  if (!token) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
        <p className="text-sm text-coral-600">Brak tokenu resetu hasła w adresie. Poproś o nowy link.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="w-full max-w-sm rounded-xl2 border border-ink-100 bg-surface p-8 shadow-card">
        <h1 className="text-xl font-semibold">Ustaw nowe hasło</h1>

        {done ? (
          <p className="mt-6 rounded-xl2 border border-teal-100 bg-teal-100/40 p-4 text-sm text-teal-700">
            Hasło zostało zmienione. Przekierowujemy Cię do logowania...
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="password" className="text-sm font-medium text-ink-700">Nowe hasło (min. 8 znaków)</label>
              <input id="password" name="password" type="password" required minLength={8} className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500" />
            </div>
            {error && <p className="text-sm text-coral-600">{error}</p>}
            <button disabled={loading} className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
              {loading ? "Zapisywanie..." : "Zmień hasło"}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-ink-500">
          <Link href="/konto/logowanie" className="text-teal-700 hover:underline">Wróć do logowania</Link>
        </p>
      </div>
    </div>
  );
}
