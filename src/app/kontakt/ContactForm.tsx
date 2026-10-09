"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input, Textarea } from "@/components/ui/Input";

type Status = "idle" | "sending" | "sent" | "error";

const MESSAGE_MIN = 5;
const MESSAGE_MAX = 4000;

/**
 * The contact form. The request body is unchanged ({ email, message } to
 * POST /api/contact). The status area is always in the DOM so that the screen
 * reader announces the confirmation; errors use role="alert" (FormMessage).
 * `initialMessage` lets a link such as /kontakt?oferta=slug start the message
 * with the offer it is about.
 */
export function ContactForm({ initialMessage = "" }: { initialMessage?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    const form = new FormData(e.currentTarget);
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
        <form className="space-y-5" onSubmit={onSubmit}>
          <Field label="Twój e-mail" hint="Na ten adres odpowiemy." required>
            {(control) => <Input name="email" type="email" autoComplete="email" inputMode="email" {...control} />}
          </Field>
          <Field
            label="Wiadomość"
            hint={`Opisz sprawę i, jeśli dotyczy oferty, wklej adres strony. Nie podawaj haseł ani numerów kart. Od ${MESSAGE_MIN} do ${MESSAGE_MAX} znaków.`}
            required
          >
            {(control) => (
              <Textarea
                name="message"
                rows={7}
                minLength={MESSAGE_MIN}
                maxLength={MESSAGE_MAX}
                defaultValue={initialMessage}
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
