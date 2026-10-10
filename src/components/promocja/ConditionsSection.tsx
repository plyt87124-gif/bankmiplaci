import type { ReactNode } from "react";
import { ListChecks } from "lucide-react";
import { ConditionsChecklist } from "@/components/ConditionsChecklist";

/**
 * "Warunki promocji {bank} krok po kroku": the offer's conditions as a numbered,
 * static list (ConditionsChecklist), with a link to the ściąga card that
 * follows. The card itself (JoinChecklistButton) is passed in as `children`
 * and sits BELOW the list, as the layout spec asks.
 *
 * An offer without conditions still gets the section, with an honest sentence
 * - an empty list would read as "nothing to do".
 */
export function ConditionsSection({
  bankName,
  conditions,
  hasChecklist,
  children
}: {
  bankName: string;
  conditions: readonly { id: string; title: string; description: string | null }[];
  /** The offer has a ściąga (checklist steps), so the card and the link to it exist. */
  hasChecklist: boolean;
  /** The ściąga card. */
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="warunki-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="warunki-h">Warunki promocji {bankName} krok po kroku</h2>
        {hasChecklist ? (
          <a href="#sciaga" className="link-inline inline-flex min-h-11 items-center gap-1.5 text-small font-medium">
            <ListChecks size={16} aria-hidden="true" className="shrink-0" />
            Prowadź mnie krok po kroku (ściąga)
          </a>
        ) : null}
      </div>

      <div className="mt-5">
        {conditions.length > 0 ? (
          <>
            {/*
              The conditions are numbered, but not every entry is an action: the data cannot tell a step from a
              rule or a limit (PromotionCondition.type does not separate them), so the list says so.
            */}
            <p className="mb-5 text-small text-ink-500">
              Obok kroków do wykonania lista zawiera dodatkowe zasady i ograniczenia, np. terminy wypłat czy to, kto
              może wziąć udział.
            </p>
            <ConditionsChecklist conditions={[...conditions]} />
          </>
        ) : (
          <p className="text-article text-ink-700">
            Nie mamy jeszcze rozpisanych kroków tej promocji. Sprawdź warunki w regulaminie banku (link w sekcji
            „Źródło i weryfikacja”).
          </p>
        )}
      </div>

      {children ? (
        <div id="sciaga" className="mt-8 scroll-mt-20">
          {children}
        </div>
      ) : null}
    </section>
  );
}
