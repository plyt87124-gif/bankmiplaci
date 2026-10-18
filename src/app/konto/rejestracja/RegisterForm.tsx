"use client";

import Link from "next/link";
import { useCallback, useId, useState, type FormEvent, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { finishSentence, postAuth } from "@/app/konto/logowanie/authFlow";
import type { RegisterField, RegisterFieldErrors } from "@/app/api/account/register/registerInput";
import { validateRegisterForm } from "./registerMessages";

// DOM order = the order in which the first invalid field gets the focus.
const FIELD_ORDER: RegisterField[] = ["name", "username", "email", "password", "acceptTerms"];

const NEW_TAB_NOTE = <span className="sr-only"> (otwiera się w nowej karcie)</span>;

/**
 * Sign-up form shared by the AuthModal and /konto/rejestracja. The consent
 * checkbox is required and NEVER pre-ticked; the server re-checks it
 * (/api/account/register) and stores when and to which version of the terms
 * the user agreed.
 */
export function RegisterForm({
  onSuccess,
  firstFieldRef
}: {
  onSuccess: () => void;
  firstFieldRef?: Ref<HTMLInputElement>;
}) {
  const [errors, setErrors] = useState<RegisterFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const termsErrorId = useId();
  const formErrorId = useId();

  const setFirstFieldRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (typeof firstFieldRef === "function") firstFieldRef(node);
      else if (firstFieldRef) (firstFieldRef as { current: HTMLInputElement | null }).current = node;
    },
    [firstFieldRef]
  );

  function focusField(form: HTMLFormElement, field: RegisterField) {
    const el = form.elements.namedItem(field);
    if (el instanceof HTMLElement) el.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const formEl = e.currentTarget;
    const data = new FormData(formEl);
    const values = {
      name: String(data.get("name") ?? ""),
      username: String(data.get("username") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      acceptTerms: data.get("acceptTerms") !== null
    };

    setFormError(null);
    const clientErrors = validateRegisterForm(values);
    setErrors(clientErrors);
    const firstInvalid = FIELD_ORDER.find((f) => clientErrors[f]);
    if (firstInvalid) {
      focusField(formEl, firstInvalid);
      return;
    }

    setLoading(true);
    const result = await postAuth(
      "/api/account/register",
      {
        name: values.name.trim() || undefined,
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
        acceptTerms: true
      },
      "Nie udało się założyć konta."
    );
    setLoading(false);

    if (!result.ok) {
      const field = FIELD_ORDER.find((f) => f === result.field);
      if (field) {
        setErrors({ [field]: finishSentence(result.error) });
        focusField(formEl, field);
      } else {
        setFormError(result.error);
      }
      return;
    }
    onSuccess();
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <Field label="Imię (opcjonalnie)" error={errors.name}>
        {(control) => <Input {...control} ref={setFirstFieldRef} name="name" autoComplete="given-name" />}
      </Field>
      <Field
        label="Nazwa użytkownika"
        hint="Zalogujesz się tą nazwą zamiast e-maila. 3–20 znaków: litery, cyfry, podkreślenia."
        error={errors.username}
        required
      >
        {(control) => (
          <Input
            {...control}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            placeholder="np. jan_kowalski"
          />
        )}
      </Field>
      <Field label="E-mail" error={errors.email} required>
        {(control) => <Input {...control} name="email" type="email" autoComplete="email" spellCheck={false} />}
      </Field>
      <Field label="Hasło" hint="Min. 8 znaków." error={errors.password} required>
        {(control) => <Input {...control} name="password" type="password" autoComplete="new-password" />}
      </Field>

      <div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="checkbox mt-0.5 aria-[invalid=true]:border-coral-600"
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? termsErrorId : undefined}
          />
          <span className="text-small text-ink-700">
            Akceptuję{" "}
            <Link href="/regulamin" target="_blank" rel="noopener" className="link-inline">
              Regulamin{NEW_TAB_NOTE}
            </Link>{" "}
            i potwierdzam zapoznanie się z{" "}
            <Link href="/polityka-prywatnosci" target="_blank" rel="noopener" className="link-inline">
              Polityką prywatności{NEW_TAB_NOTE}
            </Link>
            .<span className="sr-only"> (wymagane)</span>
            <span aria-hidden="true" className="ml-0.5 text-coral-600">
              *
            </span>
          </span>
        </label>
        <FormMessage id={termsErrorId}>{errors.acceptTerms}</FormMessage>
      </div>

      <FormMessage id={formErrorId} className="!mt-3">
        {formError}
      </FormMessage>
      <Button type="submit" fullWidth loading={loading}>
        {loading ? "Tworzenie konta…" : "Załóż konto"}
      </Button>
    </form>
  );
}
