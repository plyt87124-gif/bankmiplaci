import { ConditionsChecklist } from "@/components/ConditionsChecklist";

/**
 * "Warunki promocji {bank} krok po kroku": the offer's conditions as a numbered,
 * static list (ConditionsChecklist). The ściąga card lives in the aside.
 *
 * An offer without conditions still gets the section, with an honest sentence
 * - an empty list would read as "nothing to do".
 */
export function ConditionsSection({
  bankName,
  conditions
}: {
  bankName: string;
  conditions: readonly { id: string; title: string; description: string | null }[];
}) {
  return (
    <section aria-labelledby="warunki-h">
      <h2 id="warunki-h">Warunki promocji {bankName} krok po kroku</h2>

      <div className="mt-5">
        {conditions.length > 0 ? (
          // No intro sentence about "steps and rules" (owner, 2026-11-07; see src/lib/offerCopyRules.ts).
          <ConditionsChecklist conditions={[...conditions]} />
        ) : (
          <p className="text-article text-ink-700">
            Nie mamy jeszcze rozpisanych kroków tej promocji. Sprawdź warunki w regulaminie banku (link w sekcji
            „Źródło i weryfikacja”).
          </p>
        )}
      </div>
    </section>
  );
}
