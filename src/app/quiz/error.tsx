"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

/**
 * Error boundary of the quiz (the offers are read on the server; if that
 * fails, the visitor gets a way to retry or to go on without the quiz).
 * Header and footer stay on screen.
 */
export default function QuizError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-8 md:py-12">
      <div className="container-reading">
        <h1>Nie udało się wczytać quizu</h1>
        <p role="alert" className="type-lead mt-4 text-ink-700">
          Nie mogliśmy pobrać aktualnych promocji do dopasowania. Spróbuj ponownie. Jeśli błąd wraca, skorzystaj z listy
          promocji.
        </p>
        {error.digest ? <p className="mt-3 text-caption text-ink-500">Kod błędu: {error.digest}</p> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={reset}>Spróbuj ponownie</Button>
          <ButtonLink href="/promocje" variant="secondary">
            Zobacz promocje
          </ButtonLink>
          <ButtonLink href="/porownaj" variant="secondary">
            Porównaj promocje
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
