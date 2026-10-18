"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { postAuth } from "@/app/konto/logowanie/authFlow";

const MIN_PASSWORD_LENGTH = 8;

/** Client part of /konto/reset-hasla: sets a new password for the token from the e-mailed link. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formErrorId = useId();

  // After success the user is sent to the sign-in page after 2 s (as before);
  // the page also offers a link, so nobody has to wait or race the timer.
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => router.push("/konto/logowanie"), 2000);
    return () => window.clearTimeout(timer);
  }, [done, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const password = String(new FormData(e.currentTarget).get("password") ?? "");

    setFormError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError("Hasło musi mieć min. 8 znaków.");
      passwordRef.current?.focus();
      return;
    }
    setPasswordError(null);

    setLoading(true);
    const result = await postAuth("/api/account/reset-password", { token, password }, "Nie udało się zresetować hasła.");
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div>
        <FormMessage tone="success" className="!mt-0 text-small">
          Hasło zostało zmienione. Za chwilę przeniesiemy Cię do logowania.
        </FormMessage>
        <ButtonLink href="/konto/logowanie" fullWidth className="mt-5">
          Przejdź do logowania
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <Field label="Nowe hasło" hint="Min. 8 znaków." error={passwordError} required>
          {(control) => (
            <Input
              {...control}
              ref={passwordRef}
              name="password"
              type="password"
              autoComplete="new-password"
              aria-describedby={[control["aria-describedby"], formError ? formErrorId : undefined].filter(Boolean).join(" ") || undefined}
            />
          )}
        </Field>
        <FormMessage id={formErrorId} className="!mt-3">
          {formError}
        </FormMessage>
        <Button type="submit" fullWidth loading={loading}>
          {loading ? "Zapisywanie…" : "Zmień hasło"}
        </Button>
      </form>
      <Link href="/konto/logowanie" className="link-inline mt-4 inline-flex min-h-11 items-center text-small">
        Wróć do logowania
      </Link>
    </>
  );
}
