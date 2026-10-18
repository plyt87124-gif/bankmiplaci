import type { ReactNode } from "react";
import { Clock, XCircle } from "lucide-react";
import { EffortMeter } from "@/components/ui/EffortMeter";
import { Amount } from "@/components/ui/Money";
import { cn } from "@/lib/cn";
import { resolveFee } from "@/lib/feeModel";
import type { Difficulty } from "@prisma/client";
import { FeeValue } from "./FeeValue";
import { cooldownShort, termFact, type CooldownRule, type FactTone } from "./offerModel";

const TONE_CLASS: Record<FactTone, string> = {
  neutral: "text-ink-700",
  warn: "text-warn",
  danger: "text-coral-600"
};

function Fact({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 bg-surface p-4 md:p-5", className)}>
      <dt className="type-label text-ink-500">{label}</dt>
      <dd className="mt-1.5 text-ui text-ink-900">{children}</dd>
    </div>
  );
}

/**
 * "W skrócie": the five facts a reader compares offers by, in one bar with
 * hairline separators (a grid with a 1 px gap over the line colour, so the
 * separators survive any wrapping): premium (the only big serif number on the
 * page besides the aside), deadline, difficulty, account fee, and the
 * cooldown rule (or "Dla kogo" when there is none).
 *
 * The premium is NOT repeated in a separate tile. An offer without a cash
 * premium (maxBonusCents = 0) says "Bez premii gotówkowej" instead of 0 zł. A
 * fee that is not verified says "Brak danych" - never 0 zł; a 0 zł fee next to
 * an "Inne opłaty" remark says "od 0 zł" (the shared fee model, the same words
 * as the fees section, the FAQ and the JSON-LD).
 */
export function KeyFacts({
  maxBonusCents,
  endDate,
  difficulty,
  fees,
  cooldown,
  hasEligibilityText,
  blocked = false,
  now
}: {
  maxBonusCents: number;
  endDate: Date | string;
  difficulty: Difficulty;
  fees: { accountFeeCents: number | null; accountFeeWaiverCondition: string | null; otherFee?: string | null } | null;
  cooldown: CooldownRule | null;
  /** eligibleFor / notEligibleFor exist, so the "Dla kogo jest promocja?" section is on the page. */
  hasEligibilityText: boolean;
  /** The visitor's karencja rules them out: the bar gets the red glow. */
  blocked?: boolean;
  now?: Date;
}) {
  const term = termFact(endDate, now);
  const fee = resolveFee(fees?.accountFeeCents, fees?.accountFeeWaiverCondition, fees?.otherFee);
  const hasBonus = maxBonusCents > 0;

  return (
    <section aria-labelledby="w-skrocie" className="mt-8">
      <h2 id="w-skrocie" className="type-label mb-2 text-ink-500">
        W skrócie
      </h2>
      <dl
        data-vt-dest="card"
        data-blocked={blocked ? "true" : undefined}
        style={{ viewTransitionName: "vt-card" }}
        className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]">
        <Fact label={hasBonus ? "Premia do" : "Premia"} className="col-span-2 md:col-span-1">
          {hasBonus ? (
            <span style={{ viewTransitionName: "vt-amount" }} className="block">
              <Amount cents={maxBonusCents} variant="card" className="block text-[2.5rem] leading-[2.75rem]" />
            </span>
          ) : (
            <span className="block font-display text-h3 text-ink-900">Bez premii gotówkowej</span>
          )}
        </Fact>

        <Fact label="Termin">
          <span className="block font-semibold">{term.primary}</span>
          {term.secondary ? (
            <span className={cn("mt-0.5 flex items-start gap-1 text-small", TONE_CLASS[term.tone])}>
              {term.tone === "neutral" ? null : <Clock size={14} aria-hidden="true" className="mt-[3px] shrink-0" />}
              {term.secondary}
            </span>
          ) : term.tone === "danger" ? (
            <span className="mt-0.5 flex items-start gap-1 text-small text-coral-600">
              <XCircle size={14} aria-hidden="true" className="mt-[3px] shrink-0" />
              Zapisy zamknięte
            </span>
          ) : null}
        </Fact>

        <Fact label="Trudność">
          <span style={{ viewTransitionName: "vt-effort" }} className="inline-flex max-w-full">
            <EffortMeter difficulty={difficulty} className="max-w-full flex-wrap gap-y-1" />
          </span>
        </Fact>

        <Fact label="Opłata za konto">
          <FeeValue fee={fee} className="block" />
          {fee.kind === "conditional" ? (
            <span className="mt-0.5 block text-small text-ink-700">{fee.waiverNote}</span>
          ) : null}
          {fee.kind === "free" && fee.hasCaveat ? (
            <a href="#oplaty" className="link-inline mt-0.5 inline-block text-small">
              Sprawdź warunki opłat
            </a>
          ) : null}
        </Fact>

        {cooldown ? (
          <Fact label="Dla nowych klientów">
            <span className="block font-semibold">{cooldownShort(cooldown)}</span>
            <a href="#dla-kogo" className="link-inline mt-0.5 inline-block text-small">
              Szczegóły karencji
            </a>
          </Fact>
        ) : (
          <Fact label="Dla kogo">
            {hasEligibilityText ? (
              <a href="#dla-kogo" className="link-inline font-semibold">
                Zobacz, kto może
              </a>
            ) : (
              <span className="block font-semibold text-ink-500">Brak danych</span>
            )}
          </Fact>
        )}
      </dl>
    </section>
  );
}
