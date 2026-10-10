"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { requestReset } from "./requestReset";

/** An empty field asks for the address; a filled but wrong one says it is not valid. Both are full sentences. */
export function forgotEmailError(email: string): string {
  return email.trim() ? "Podaj poprawny adres e-mail." : "Podaj adres e-mail.";
}

/** Client part of /konto/zapomniane-haslo. The success message never reveals whether the account exists. */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const formErrorId = useId();

  // After success the form (and the button that had focus) leaves the DOM:
  // move focus to the message container so keyboard and screen reader users
  // do not end up on <body>.
  useEffect(() => {
    if (sent) resultRef.current?.focus();
  }, [sent]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();

    setFormError(null);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError(forgotEmailError(email));
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

  return (
    <>
      {sent ? null : (
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
      )}
      {/* Always in the DOM: the live region is empty until success, so the message is announced when it is added. */}
      <div
        ref={resultRef}
        tabIndex={-1}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
      >
        <div role="status">
          {sent ? (
            <p className="flex items-start gap-1.5 text-small font-medium text-success">
              <CheckCircle2 size={16} aria-hidden="true" className="mt-1 shrink-0" />
              <span>Jeśli konto o takim adresie istnieje, wysłaliśmy link do resetu hasła.</span>
            </p>
          ) : null}
        </div>
        {sent && devUrl ? (
          <div className="mt-4 rounded-card border border-line bg-sunken p-4 text-small text-ink-700">
            <p className="font-medium">Tryb deweloperski — link resetu pokazany bezpośrednio na stronie.</p>
            <p className="mt-1">Użyj poniższego linku, żeby zresetować hasło:</p>
            <Link href={devUrl} className="link-inline mt-2 block [overflow-wrap:anywhere]">
              {devUrl}
            </Link>
          </div>
        ) : null}
      </div>
      {backLink}
    </>
  );
}
