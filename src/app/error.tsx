"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusPage, StatusSearch } from "@/components/ui/StatusPage";

/**
 * Error boundary for every route below the root layout (header and footer stay
 * on screen). `reset` re-renders the segment; if the failure was temporary,
 * that is all it takes.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="Błąd"
      title="Coś poszło nie tak"
      description="Nie udało się wyświetlić tej strony. Spróbuj ponownie. Jeśli błąd wraca, przejdź do listy promocji albo wyszukaj bank lub ofertę."
      detail={error.digest ? `Kod błędu: ${error.digest}` : undefined}
      actions={
        <>
          <Button onClick={reset}>Spróbuj ponownie</Button>
          <ButtonLink href="/promocje" variant="secondary">
            Zobacz promocje
          </ButtonLink>
          <ButtonLink href="/porownaj" variant="secondary">
            Porównaj promocje
          </ButtonLink>
          <ButtonLink href="/quiz" variant="secondary">
            Quiz: dobierz promocję
          </ButtonLink>
        </>
      }
    >
      <StatusSearch />
    </StatusPage>
  );
}
