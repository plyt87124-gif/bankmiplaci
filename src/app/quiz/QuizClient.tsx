"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { DeadlineBadge } from "@/components/trust/DeadlineBadge";
import { BankLogo } from "@/components/ui/BankLogo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EffortMeter } from "@/components/ui/EffortMeter";
import { Amount } from "@/components/ui/Money";
import { cn } from "@/lib/cn";
import {
  QUIZ_QUESTIONS,
  QUIZ_QUESTION_COUNT,
  buildCompareHref,
  explainMatch,
  matchOffers,
  parseAnswers,
  type QuizDraft,
  type QuizMatch,
  type QuizOffer
} from "@/lib/quiz";

/**
 * The quiz wizard: one question per screen, a progress bar, "Wstecz", and the
 * result (#1 to #3 with a reason each, plus a link to compare them). The
 * offers arrive as props from the server component; scoring is the pure
 * `matchOffers` of lib/quiz.ts, so nothing is fetched here and the answers
 * never leave the browser.
 */
export function QuizClient({ offers }: { offers: QuizOffer[] }) {
  const [draft, setDraft] = useState<QuizDraft>({});
  // 0..N-1 = a question, N = the result.
  const [step, setStep] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const finished = step >= QUIZ_QUESTION_COUNT;
  const answers = useMemo(() => parseAnswers(draft), [draft]);
  const matches = useMemo(() => (finished && answers ? matchOffers(offers, answers) : []), [finished, answers, offers]);

  // After "Dalej"/"Wstecz" the keyboard and screen-reader focus moves to the new
  // title (otherwise it would stay on a button that no longer exists).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [step]);

  if (offers.length === 0) {
    return (
      <div role="status" className="rounded-card border border-line bg-sunken p-5">
        <p className="font-semibold text-ink-900">Nie mamy teraz aktualnych promocji do dopasowania.</p>
        <p className="mt-1 text-small text-ink-700">
          Sprawdź za jakiś czas albo zajrzyj do <Link href="/promocje" className="link-inline">listy promocji</Link>.
        </p>
      </div>
    );
  }

  if (finished && answers) {
    return (
      <QuizResult
        matches={matches}
        audience={answers.audience}
        titleRef={titleRef}
        onChange={() => setStep(0)}
        onRestart={() => {
          setDraft({});
          setStep(0);
        }}
      />
    );
  }

  const question = QUIZ_QUESTIONS[Math.min(step, QUIZ_QUESTION_COUNT - 1)];
  if (!question) return null;
  const selected = draft[question.id];
  const isLast = step === QUIZ_QUESTION_COUNT - 1;
  const titleId = `quiz-q-${question.id}`;
  const hintId = question.hint ? `${titleId}-hint` : undefined;

  function next(event?: FormEvent) {
    event?.preventDefault();
    if (!selected) return;
    setStep((s) => s + 1);
  }

  return (
    <form onSubmit={next} noValidate>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-small font-semibold text-ink-700" aria-live="polite">
          Pytanie {step + 1} z {QUIZ_QUESTION_COUNT}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Postęp quizu"
        aria-valuemin={1}
        aria-valuemax={QUIZ_QUESTION_COUNT}
        aria-valuenow={step + 1}
        aria-valuetext={`Pytanie ${step + 1} z ${QUIZ_QUESTION_COUNT}`}
        className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100"
      >
        <div
          className="h-full origin-left bg-teal-500 transition-transform duration-reveal ease-out"
          style={{ transform: `scaleX(${(step + 1) / QUIZ_QUESTION_COUNT})` }}
        />
      </div>

      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="mt-8 text-h3 font-semibold focus:outline-none">
        {question.title}
      </h2>
      {question.hint ? (
        <p id={hintId} className="mt-1 text-small text-ink-500">
          {question.hint}
        </p>
      ) : null}

      <fieldset aria-labelledby={titleId} aria-describedby={hintId} className="mt-5 min-w-0">
        <div className="space-y-3">
          {question.options.map((option) => {
            const checked = selected === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-ui text-ink-900",
                  "[transition:background-color_150ms_var(--ease-out,ease),border-color_150ms_var(--ease-out,ease)]",
                  "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring",
                  checked ? "border-action bg-teal-100" : "border-line-strong bg-surface hover:bg-sunken"
                )}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.id}
                  checked={checked}
                  onChange={() => setDraft((d) => ({ ...d, [question.id]: option.id }))}
                  className="h-5 w-5 shrink-0"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ArrowLeft size={18} aria-hidden="true" />
            Wstecz
          </Button>
        ) : null}
        <Button type="submit" disabled={!selected}>
          {isLast ? "Pokaż wyniki" : "Dalej"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

function QuizResult({
  matches,
  audience,
  titleRef,
  onChange,
  onRestart
}: {
  matches: QuizMatch[];
  audience: "personal" | "business";
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  onChange: () => void;
  onRestart: () => void;
}) {
  return (
    <section aria-labelledby="quiz-result-title">
      <h2 id="quiz-result-title" ref={titleRef} tabIndex={-1} className="focus:outline-none">
        Twoje dopasowane promocje
      </h2>

      {matches.length === 0 ? (
        <div role="status" className="mt-4 rounded-card border border-line bg-sunken p-5">
          <p className="font-semibold text-ink-900">Brak ofert pasujących do tych odpowiedzi.</p>
          <p className="mt-1 text-small text-ink-700">
            W tej chwili nie mamy aktualnej promocji dla wybranego rodzaju konta. Zmień odpowiedzi albo zajrzyj do{" "}
            <Link href="/promocje" className="link-inline">
              pełnej listy promocji
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-ui text-ink-700">
            Ułożyliśmy oferty według Twoich odpowiedzi. Kolejność nie zależy od prowizji, którą możemy otrzymać od banku.
          </p>
          <AffiliateDisclosure variant="strip" sort="quiz" className="mt-5" />
          <ol className="mt-6 space-y-4">
            {matches.map((match, index) => (
              <li key={match.offer.slug}>
                <ResultCard match={match} rank={index + 1} />
              </li>
            ))}
          </ol>
          {matches.length > 1 ? (
            <div className="mt-6">
              <ButtonLink
                href={buildCompareHref(
                  matches.map((m) => m.offer.slug),
                  audience
                )}
                size="lg"
              >
                Porównaj te {matches.length}
              </ButtonLink>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onChange}>
          Zmień odpowiedzi
        </Button>
        <Button type="button" variant="ghost" onClick={onRestart}>
          Zacznij od nowa
        </Button>
      </div>
    </section>
  );
}

function ResultCard({ match, rank }: { match: QuizMatch; rank: number }) {
  const { offer } = match;
  const href = `/promocje/${offer.slug}`;

  return (
    <article className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 font-display text-h4 font-semibold text-ink-900"
        >
          {rank}
        </span>
        <BankLogo name={offer.bank.name} logoUrl={offer.bank.logoUrl} size="sm" />
      </div>

      <h3 className="mt-3 text-h4">
        <Link href={href} className="rounded-sm underline-offset-[3px] hover:underline">
          <span className="sr-only">Dopasowanie numer {rank}: </span>
          {offer.name}
        </Link>
      </h3>
      <p className="text-small text-ink-500">{offer.bank.name}</p>

      <div className="mt-4">
        {offer.maxBonusCents > 0 ? (
          <>
            <p className="type-label text-ink-500">Premia do</p>
            <Amount cents={offer.maxBonusCents} />
          </>
        ) : (
          <p className="font-semibold text-ink-700">Bez premii gotówkowej</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <EffortMeter difficulty={offer.difficulty} />
        <DeadlineBadge endDate={offer.endDate} />
      </div>

      <p className="mt-4 text-ui text-ink-700">{explainMatch(match)}</p>
      {match.cautions.map((caution) => (
        <p key={caution} className="mt-2 flex items-start gap-2 text-small text-ink-700">
          <TriangleAlert size={16} aria-hidden="true" className="mt-[3px] shrink-0 text-gold-500" />
          <span>{caution}</span>
        </p>
      ))}

      <ButtonLink href={href} variant="secondary" size="sm" className="mt-4">
        Szczegóły oferty
      </ButtonLink>
    </article>
  );
}
