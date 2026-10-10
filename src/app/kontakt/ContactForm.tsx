"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input, Textarea } from "@/components/ui/Input";

type Status = "idle" | "sending" | "sent" | "error";

// The limits of POST /api/contact (z.string().min(5).max(4000)).
export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 4000;

export type ContactField = "email" | "message";
export type ContactFieldErrors = Partial<Record<ContactField, string>>;

export const CONTACT_EMAIL_REQUIRED = "Podaj adres e-mail.";
export const CONTACT_EMAIL_INVALID = "Podaj poprawny adres e-mail.";
export const CONTACT_MESSAGE_INVALID = `Napisz wiadomość (od ${MESSAGE_MIN} do ${MESSAGE_MAX} znaków).`;

/**
 * Shows the problems sooner than the server would (which stays the authority:
 * the same limits, the same endpoint). An empty field says that it is needed,
 * a filled but wrong one says what is wrong; every message is a full sentence.
 */
export function validateContactValues(values: { email: string; message: string }): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  const email = values.email.trim();
  if (!email) errors.email = CONTACT_EMAIL_REQUIRED;
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = CONTACT_EMAIL_INVALID;

  const length = values.message.length;
  if (!values.message.trim() || length < MESSAGE_MIN || length > MESSAGE_MAX) errors.message = CONTACT_MESSAGE_INVALID;
  return errors;
}

/**
 * The contact form. The request body is unchanged ({ email, message } to
 * POST /api/contact). The status area is always in the DOM so that the screen
 * reader announces the confirmation; errors use role="alert" (FormMessage).
 * The form has `noValidate` and validates itself: the messages stand under the
 * fields (aria-invalid + aria-describedby, as in the sign-up form) and the
 * first invalid field gets the focus, instead of the browser's own bubble.
 * `initialMessage` lets a link such as /kontakt?oferta=slug start the message
 * with the offer it is about.
 */
export function ContactForm({ initialMessage = "" }: { initialMessage?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  function clearError(field: ContactField) {
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const message = String(form.get("message") ?? "");

    const problems = validateContactValues({ email, message });
    setFieldErrors(problems);
    if (problems.email || problems.message) {
      setError(null);
      (problems.email ? emailRef : messageRef).current?.focus();
      return;
    }

    setStatus("sending");
    setError(null);
    try {
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
      setError(typeof data?.error === "string" ? data.error : "Coś poszło nie tak. Spróbuj ponownie.");
    } catch {
      setError("Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie.");
    }
    setStatus("error");
  }

  return (
    <div>
      <div role="status">
        {status === "sent" ? (
          <p className="flex items-start gap-3 rounded-card border border-line bg-success-100 p-4 text-ui text-ink-900">
            <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            <span>Dziękujemy, wiadomość została wysłana. Jeśli zgłoszenie wymaga odpowiedzi, odpiszemy na podany adres e-mail.</span>
          </p>
        ) : null}
      </div>

      {status === "sent" ? null : (
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <Field label="Twój e-mail" hint="Na ten adres odpowiemy." error={fieldErrors.email} required>
            {(control) => (
              <Input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                ref={emailRef}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  if (!validateContactValues({ email: event.target.value, message: "x".repeat(MESSAGE_MIN) }).email) clearError("email");
                }}
                {...control}
              />
            )}
          </Field>
          <Field
            label="Wiadomość"
            hint={`Opisz sprawę i, jeśli dotyczy oferty, wklej adres strony. Nie podawaj haseł ani numerów kart. Od ${MESSAGE_MIN} do ${MESSAGE_MAX} znaków.`}
            error={fieldErrors.message}
            required
          >
            {(control) => (
              <Textarea
                name="message"
                rows={7}
                maxLength={MESSAGE_MAX}
                defaultValue={initialMessage}
                ref={messageRef}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  if (!validateContactValues({ email: "a@b.c", message: event.target.value }).message) clearError("message");
                }}
                {...control}
              />
            )}
          </Field>
          <Button type="submit" fullWidth loading={status === "sending"}>
            {status === "sending" ? "Wysyłanie…" : "Wyślij wiadomość"}
          </Button>
          {status === "error" ? <FormMessage>{error}</FormMessage> : null}
        </form>
      )}
    </div>
  );
}
