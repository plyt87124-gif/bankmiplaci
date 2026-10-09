"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";

const NETWORK_ERROR = "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.";

type ForgotResult = { ok: true; devResetUrl?: string } | { ok: false; error: string };

// Own request helper (not postAuth): in development the API returns a
// devResetUrl in the body, which postAuth does not expose. Never throws.
async function requestReset(email: string): Promise<ForgotResult> {
  let res: Response;
  try {
    res = await fetch("/api/account/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  const data = (await res.json().catch(() => null)) as { error?: unknown; devResetUrl?: unknown } | null;
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.error === "string" && data.error ? data.error : "Nie udało się wysłać linku. Spróbuj ponownie."
    };
  }
  return { ok: true, devResetUrl: typeof data?.devResetUrl === "string" ? data.devResetUrl : undefined };
}

/** Client part of /konto/zapomniane-haslo. The success message never reveals whether the account exists. */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const formErrorId = useId();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();

    setFormError(null);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError("Podaj poprawny adres e-mail.");
      emailRef.current?.focus();
      return;
    }
    setEmailError(null);

    setLoading(true);
    const result = await requestReset(email);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    if (result.devResetUrl) setDevUrl(result.devResetUrl);
    setSent(true);
  }

  const backLink = (
    <Link href="/konto/logowanie" className="link-inline mt-4 inline-flex min-h-11 items-center text-small">
      Wróć do logowania
    </Link>
  );

  if (sent) {
    return (
      <div>
        <FormMessage tone="success" className="!mt-0 text-small">
          Jeśli konto o takim adresie istnieje, wysłaliśmy link do resetu hasła.
        </FormMessage>
        {devUrl ? (
          <div className="mt-4 rounded-card border border-line bg-sunken p-4 text-small text-ink-700">
            <p className="font-medium">Tryb deweloperski — wysyłka e-maili nie jest jeszcze podłączona.</p>
            <p className="mt-1">Użyj poniższego linku, żeby zresetować hasło:</p>
            <Link href={devUrl} className="link-inline mt-2 block [overflow-wrap:anywhere]">
              {devUrl}
            </Link>
          </div>
        ) : null}
        {backLink}
      </div>
    );
  }

  return (
    <>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <Field label="E-mail" error={emailError} required>
          {(control) => (
            <Input
              {...control}
              ref={emailRef}
              name="email"
              type="email"
              autoComplete="email"
              aria-describedby={[control["aria-describedby"], formError ? formErrorId : undefined].filter(Boolean).join(" ") || undefined}
            />
          )}
        </Field>
        <FormMessage id={formErrorId} className="!mt-3">
          {formError}
        </FormMessage>
        <Button type="submit" fullWidth loading={loading}>
          {loading ? "Wysyłanie…" : "Wyślij link resetujący"}
        </Button>
      </form>
      {backLink}
    </>
  );
}
