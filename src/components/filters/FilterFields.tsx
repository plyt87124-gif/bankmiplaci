"use client";

import { Check } from "lucide-react";
import { useOptionalSession } from "@/components/SessionProvider";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { DIFFICULTY_LABEL, formatPLN } from "@/lib/format";
import { DIFFICULTY_VALUES, MIN_BONUS_OPTIONS, type ListingState } from "@/components/filters/filterParams";

/**
 * The fields that live in the filter bottom sheet (opened by "Filtry (n)"): difficulty, bank, minimum bonus and "only without fee".
 * Controlled - values come from the URL state, changes go to `onChange`.
 *
 * `idPrefix` keeps ids unique when the fields are rendered more than once. Every control has a visible label (axe select-name);
 * difficulty is a fieldset with a legend and toggle buttons (`aria-pressed`,
 * a check mark besides the colour, 44 px high).
 */
export function FilterFields({
  idPrefix,
  banks,
  state,
  onChange,
  className
}: {
  idPrefix: string;
  banks: readonly { slug: string; name: string }[];
  state: ListingState;
  onChange: (patch: Partial<ListingState>) => void;
  className?: string;
}) {
  const bankId = `${idPrefix}-bank`;
  const minBonusId = `${idPrefix}-min-bonus`;
  const signedIn = Boolean(useOptionalSession()?.user);
  const eligibleId = `${idPrefix}-eligible`;
  const endedId = `${idPrefix}-ended`;
  const noFeesId = `${idPrefix}-no-fees`;
  const noFeesHintId = `${idPrefix}-no-fees-hint`;

  const knownBank = banks.some((bank) => bank.slug === state.bank);
  const knownMinBonus = state.minBonus == null || MIN_BONUS_OPTIONS.some((option) => option.value === state.minBonus);

  function toggleDifficulty(value: (typeof DIFFICULTY_VALUES)[number]) {
    const next = state.difficulty.includes(value)
      ? state.difficulty.filter((d) => d !== value)
      : DIFFICULTY_VALUES.filter((d) => d === value || state.difficulty.includes(d));
    onChange({ difficulty: [...next] });
  }

  return (
    <div className={cn("space-y-6", className)}>
      <fieldset>
        <legend className="mb-2 text-small font-semibold text-ink-900">Poziom trudności</legend>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_VALUES.map((value) => {
            const pressed = state.difficulty.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={pressed}
                onClick={() => toggleDifficulty(value)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3.5 text-small font-semibold",
                  "[transition:background-color_150ms_var(--ease-out,ease),border-color_150ms_var(--ease-out,ease)]",
                  pressed
                    ? "border-action bg-teal-100 text-teal-700"
                    : "border-line-strong bg-surface text-ink-700 hover:bg-sunken"
                )}
              >
                {pressed ? <Check size={16} aria-hidden="true" className="shrink-0" /> : null}
                {DIFFICULTY_LABEL[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <Label htmlFor={bankId}>Bank</Label>
        <Select
          id={bankId}
          value={state.bank}
          onChange={(event) => onChange({ bank: event.target.value })}
          className="h-11"
        >
          <option value="">Wszystkie banki</option>
          {knownBank || !state.bank ? null : <option value={state.bank}>{state.bank}</option>}
          {banks.map((bank) => (
            <option key={bank.slug} value={bank.slug}>
              {bank.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor={minBonusId}>Minimalna premia</Label>
        <Select
          id={minBonusId}
          value={state.minBonus ? String(state.minBonus) : ""}
          onChange={(event) => onChange({ minBonus: event.target.value ? Number(event.target.value) : null })}
          className="h-11"
        >
          <option value="">Dowolna</option>
          {knownMinBonus || !state.minBonus ? null : (
            <option value={String(state.minBonus)}>od {formatPLN(state.minBonus)}</option>
          )}
          {MIN_BONUS_OPTIONS.map((option) => (
            <option key={option.value} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor={noFeesId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
          <input
            id={noFeesId}
            type="checkbox"
            checked={state.noFees}
            aria-describedby={noFeesHintId}
            onChange={(event) => onChange({ noFees: event.target.checked })}
            className="checkbox checkbox-sm mt-0.5"
          />
          <span className="text-small font-semibold text-ink-900">Tylko bez opłaty za prowadzenie konta</span>
        </label>
        <p id={noFeesHintId} className="ml-8 text-caption text-ink-500">
          Pokazujemy oferty z potwierdzoną opłatą 0 zł, bez warunków.
        </p>
      </div>

      <div>
        <label htmlFor={endedId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
          <input
            id={endedId}
            type="checkbox"
            checked={state.ended}
            onChange={(event) => onChange({ ended: event.target.checked })}
            className="checkbox checkbox-sm mt-0.5"
          />
          <span className="text-small font-semibold text-ink-900">Pokaż zakończone promocje</span>
        </label>
        <p className="ml-8 text-caption text-ink-500">Zamiast aktualnych: promocje, których zapisy już się zamknęły.</p>
      </div>

      {signedIn ? (
        <div>
          <label htmlFor={eligibleId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
            <input
              id={eligibleId}
              type="checkbox"
              checked={state.eligibleOnly}
              onChange={(event) => onChange({ eligibleOnly: event.target.checked })}
              className="checkbox checkbox-sm mt-0.5"
            />
            <span className="text-small font-semibold text-ink-900">Tylko te, w których mogę wziąć udział</span>
          </label>
          <p className="ml-8 text-caption text-ink-500">
            Na podstawie karencji i banków, w których jesteś klientem (zakładka „Moje konto”).
          </p>
        </div>
      ) : null}
    </div>
  );
}
