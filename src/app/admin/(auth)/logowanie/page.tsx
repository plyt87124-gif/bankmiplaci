"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false
    });

    setLoading(false);
    if (result?.error) {
      setError("Nieprawidłowy e-mail lub hasło.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl2 border border-ink-100 bg-surface p-8 shadow-card">
        <h1 className="text-xl font-semibold">Panel administracyjny</h1>
        <p className="mt-1 text-sm text-ink-500">Zaloguj się, aby zarządzać promocjami.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-ink-700">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1.5 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-ink-700">
              Hasło
            </label>
            <input
              id="password"
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
      </div>
    </div>
  );
}
