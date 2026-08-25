"use client";

import { useState } from "react";

export default function KontaktPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), message: form.get("message") })
    });
    if (res.ok) {
      setStatus("sent");
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "Coś poszło nie tak. Spróbuj ponownie.");
    setStatus("error");
  }

  return (
    <div className="container-page max-w-lg py-14">
      <h1 className="text-3xl font-semibold">Kontakt</h1>
      <p className="mt-3 text-ink-500">
        Zauważyłeś nieaktualną promocję albo błąd w warunkach? Daj nam znać — każde zgłoszenie trafia do
        weryfikacji przed aktualizacją bazy.
      </p>

      {status === "sent" ? (
        <p className="mt-8 rounded-xl2 border border-teal-100 bg-teal-100/40 p-4 text-sm text-teal-700">
          Dziękujemy, wiadomość została wysłana.
        </p>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-ink-700">
              Twój e-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label htmlFor="message" className="text-sm font-medium text-ink-700">
              Wiadomość
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <button
            disabled={status === "sending"}
            className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {status === "sending" ? "Wysyłanie..." : "Wyślij wiadomość"}
          </button>
          {status === "error" && <p className="text-sm text-coral-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
