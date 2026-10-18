"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { postAuth } from "./authFlow";

type LoginErrors = { identifier?: string; password?: string };

/**
 * Sign-in form shared by the AuthModal and /konto/logowanie. It only talks to
 * /api/account/login; what happens next (close the modal, redirect) is the
 * caller's `onSuccess`.
 */
export function LoginForm({
  onSuccess,
  firstFieldRef
}: {
  onSuccess: () => void;
  /** The modal focuses the first field when it opens and after a mode switch. */
  firstFieldRef?: Ref<HTMLInputElement>;
}) {
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const identifierRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const formErrorId = useId();

  // The submit button was disabled while loading and dropped focus: after a
  // failed attempt put it back on the password, whose aria-describedby now
  // points at the message.
  useEffect(() => {
    if (formError) passwordRef.current?.focus();
  }, [formError]);

  // Stable identity: a new ref callback every render would be called with
  // null and then the node again on each keystroke-driven re-render.
  const setIdentifierRef = useCallback(
    (node: HTMLInputElement | null) => {
      identifierRef.current = node;
      if (typeof firstFieldRef === "function") firstFieldRef(node);
      else if (firstFieldRef) (firstFieldRef as { current: HTMLInputElement | null }).current = node;
    },
    [firstFieldRef]
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const form = new FormData(e.currentTarget);
    const identifier = String(form.get("identifier") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const nextErrors: LoginErrors = {};
    if (!identifier) nextErrors.identifier = "Podaj e-mail lub nazwę użytkownika.";
    if (!password) nextErrors.password = "Podaj hasło.";
    setErrors(nextErrors);
    setFormError(null);
    if (nextErrors.identifier || nextErrors.password) {
      (nextErrors.identifier ? identifierRef : passwordRef).current?.focus();
      return;
    }

    setLoading(true);
    const result = await postAuth("/api/account/login", { identifier, password }, "Nie udało się zalogować.");
    setLoading(false);

    if (!result.ok) {
      // Deliberately one generic message (the API never says which part was wrong).
      setFormError(result.error);
      return;
    }
    onSuccess();
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <Field label="E-mail lub nazwa użytkownika" error={errors.identifier} required>
        {(control) => (
          <Input
            {...control}
            ref={setIdentifierRef}
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </Field>
      <Field label="Hasło" error={errors.password} required>
        {(control) => (
          <Input
            {...control}
            ref={passwordRef}
            name="password"
            type="password"
            autoComplete="current-password"
            aria-describedby={[control["aria-describedby"], formError ? formErrorId : undefined].filter(Boolean).join(" ") || undefined}
          />
        )}
      </Field>
      <FormMessage id={formErrorId} className="!mt-3">
        {formError}
      </FormMessage>
      <Button type="submit" fullWidth loading={loading}>
        {loading ? "Logowanie…" : "Zaloguj się"}
      </Button>
    </form>
  );
}
