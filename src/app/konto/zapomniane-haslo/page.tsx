"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/account/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") })
    });
    const data = await res.json().catch(() => null);

    setLoading(false);
    setSent(true);
    if (data?.devResetUrl) setDevUrl(data.devResetUrl);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="w-full max-w-sm rounded-xl2 border border-ink-100 bg-surface p-8 shadow-card">
        <h1 className="text-xl font-semibold">Nie pamiętasz hasła?</h1>
        <p className="mt-1 text-sm text-ink-500">Podaj adres e-mail, na który założono konto.</p>

        {sent ? (
          <div className="mt-6">
            <p className="rounded-xl2 border border-teal-100 bg-teal-100/40 p-4 text-sm text-teal-700">
              Jeśli konto o takim adresie istnieje, wysłaliśmy link do resetu hasła.
            </p>
            {devUrl && (
              <div className="mt-4 rounded-xl2 border border-gold-100 bg-gold-100/40 p-4 text-xs text-ink-700">
                <p className="font-medium">Tryb deweloperski — wysyłka e-maili nie jest jeszcze podłączona.</p>
                <p className="mt-1">Kliknij poniższy link, żeby zresetować hasło:</p>
                <Link href={devUrl} className="mt-2 block break-all text-teal-700 underline">{devUrl}</Link>
              </div>
            )}
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="email" className="text-sm font-medium text-ink-700">E-mail</label>
              <input id="email" name="email" type="email" required className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500" />
            </div>
            <button disabled={loading} className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
              {loading ? "Wysyłanie..." : "Wyślij link resetujący"}
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
