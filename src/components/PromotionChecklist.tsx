"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Gift, ListChecks, Lock } from "lucide-react";
import { formatPLN, formatDate, pluralizePl } from "@/lib/format";
import { cn } from "@/lib/cn";
import { isGroupUnlocked, isMonthGroup, monthGroupLabel, periodRuleOf, unlockDateForGroup, type PeriodRule } from "@/lib/checklistSchedule";
import { resolveGroups, isRewardEarned, earnedCentsFor, type ResolvedGroup } from "@/lib/checklistAvailability";
import { useEarningsContext } from "@/components/EarningsContext";
import { BankLogo } from "@/components/ui/BankLogo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface Step {
  id: string;
  monthLabel: string;
  title: string;
  rewardCents: number | null;
  order: number;
  /** Deadline for joining the sub-offer this step belongs to; see checklistAvailability.ts. */
  availableUntil?: string | Date | null;
  /** Window counted from the agreement date instead of calendar months; see checklistSchedule.ts. */
  periodStartMonths?: number | null;
  periodMonths?: number | null;
}

interface Tracking {
  id: string;
  promotionId: string;
  promotionSlug: string;
  promotionName: string;
  bankName: string;
  bankLogoUrl: string | null;
  accountTypeLabel: string;
  accountOpenedAt: string | null;
  /** Ready-made sentences about the account and card fee (see lib/feeModel.ts); null when the offer has no fee data. */
  fees?: { account: string; card: string } | null;
  steps: Step[];
}

interface Group extends ResolvedGroup<Step> {
  label: string;
  unlocked: boolean;
  unlockDate: Date | null;
  /** Set when the regulamin counts this group's window from the agreement date (a billing period or "within 3 months"), not calendar months. */
  rule: PeriodRule | null;
  /** False for the opening group, windows from the agreement date and aggregate groups ("po 6 miesiącach"): the copy says "etap", not "miesiąc". */
  isMonth: boolean;
}

function buildGroups(steps: Step[], accountOpenedAt: Date | null): Group[] {
  // Which steps/rewards this participant can use is decided by the date they
  // actually took up the offer (accountOpenedAt), not by when they registered
  // here - see src/lib/checklistAvailability.ts.
  return resolveGroups(steps, accountOpenedAt).map((g) => {
    const groupSteps = steps.filter((s) => Math.floor(s.order / 10) === g.groupIndex);
    const rule = periodRuleOf(groupSteps);
    const storedLabel = groupSteps[0]?.monthLabel ?? "";
    return {
      ...g,
      rule,
      isMonth: isMonthGroup(g.groupIndex, storedLabel, rule),
      label: monthGroupLabel(accountOpenedAt, g.groupIndex, storedLabel, rule),
      unlocked: isGroupUnlocked(accountOpenedAt, g.groupIndex, rule),
      unlockDate: accountOpenedAt ? unlockDateForGroup(accountOpenedAt, g.groupIndex, rule) : null
    };
  });
}

function trackingEarnedCents(tracking: Tracking, checked: Set<string>): number {
  return earnedCentsFor(tracking.steps, tracking.accountOpenedAt, checked);
}

/* ------------------------------------------------------------------ */
/* Pure helpers (no React): covered by tests/checklist-ui.test.tsx.     */
/* ------------------------------------------------------------------ */

/** "2 z 5 kroków" - the total is in the genitive after "z". */
export function stepsOf(done: number, total: number): string {
  return `${done} z ${total} ${pluralizePl(total, "kroku", "kroków", "kroków")}`;
}

/** A copy of `checked` with `stepId` ticked (`present` = true) or cleared; the original is not touched. */
export function withStepChecked(checked: ReadonlySet<string>, stepId: string, present: boolean): Set<string> {
  const next = new Set(checked);
  if (present) next.add(stepId);
  else next.delete(stepId);
  return next;
}

/** Shown when "Spełniłem/am warunki" could not be saved because the request itself failed. */
export const COMPLETE_NETWORK_ERROR = "Nie udało się zapisać. Sprawdź połączenie.";

/**
 * Why closing the ściąga failed, or null when it worked. `res` is null when the
 * request never got an answer (offline, DNS, the connection dropped).
 */
export function completeFailureMessage(res: { ok: boolean } | null, data: { error?: unknown } | null): string | null {
  if (!res) return COMPLETE_NETWORK_ERROR;
  if (res.ok) return null;
  return typeof data?.error === "string" && data.error ? data.error : "Coś poszło nie tak.";
}

/** Today's calendar date in Poland (YYYY-MM-DD), the clock the server validates dates against. */
const warsawToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());

export function PromotionChecklist({
  trackings,
  initialChecked,
  completedEarnedCents,
  emptyState = true
}: {
  trackings: Tracking[];
  initialChecked: string[];
  completedEarnedCents: number;
  /** Show the "no ściąga yet" panel (with a link to /promocje) when there is nothing to show. */
  emptyState?: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialChecked));
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [closedAtDrafts, setClosedAtDrafts] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Presentation only: tells the message block whether it is good or bad news.
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  // Presentation only: the step whose last save was rejected (shown in its month).
  const [failedStepId, setFailedStepId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const visible = trackings.filter((t) => !doneIds.has(t.id));
  const activeEarnedCents = trackings.reduce((sum, t) => sum + trackingEarnedCents(t, checked), 0);
  const totalEarnedCents = completedEarnedCents + activeEarnedCents;

  // The badge itself now lives next to the "Moje konto" header (see
  // EarningsProvider in konto/page.tsx) — this is the only place that
  // actually knows the live total, so push it up through context instead
  // of rendering EarningsCounter inline here.
  const { setTotal } = useEarningsContext();
  useEffect(() => {
    setTotal(totalEarnedCents);
  }, [totalEarnedCents, setTotal]);

  // A finished ściąga disappears, together with the button that had the focus:
  // put the focus on the section heading instead of dropping it on <body>.
  const finishedCount = doneIds.size;
  useEffect(() => {
    if (finishedCount > 0) headingRef.current?.focus();
  }, [finishedCount]);

  async function toggleStep(stepId: string, next: boolean) {
    setFailedStepId(null);
    setChecked((prev) => withStepChecked(prev, stepId, next));
    const res = await fetch("/api/checklist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, checked: next })
    }).catch(() => null);
    if (!res || !res.ok) {
      // Server rejected it (e.g. month not unlocked yet) — revert the optimistic check.
      setChecked((prev) => withStepChecked(prev, stepId, !next));
      setFailedStepId(stepId);
    }
  }

  function toggleMonth(actionSteps: Step[], allChecked: boolean) {
    actionSteps.forEach((s) => toggleStep(s.id, !allChecked));
  }

  function requestConfirm(t: Tracking) {
    setConfirmingId(t.id);
    setClosedAtDrafts((prev) => ({ ...prev, [t.id]: prev[t.id] ?? warsawToday() }));
  }

  async function complete(t: Tracking) {
    setPending(t.id);
    const closedAt = closedAtDrafts[t.id] ?? warsawToday();
    // A network error must not leave the button spinning forever: treat it like a rejected save.
    const res = await fetch("/api/checklist/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionId: t.promotionId, closedAt })
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setPending(null);
    setConfirmingId(null);

    const failure = completeFailureMessage(res, data);
    if (failure) {
      setMessageKind("error");
      setSuccessMessage(failure);
      return;
    }

    setMessageKind("success");
    setSuccessMessage(
      `Uzupełniliśmy Twoją datę zamknięcia konta (${t.bankName}, ${t.accountTypeLabel}) w Twoich okresach karencji poniżej. Gdy okres karencji minie, powiadomimy Cię o możliwości skorzystania z kolejnej promocji w tym banku.`
    );
    setDoneIds((prev) => new Set(prev).add(t.id));
    router.refresh();
  }

  if (visible.length === 0 && !successMessage) {
    if (!emptyState) return null;
    return (
      <section aria-labelledby={headingId} className="mt-10">
        <h2 id={headingId}>Twoje ściągi z promocji</h2>
        <div className="mt-4 rounded-card border border-line bg-surface p-6 sm:p-8" data-testid="checklist-empty">
          <div className="flex items-start gap-4">
            <ListChecks size={24} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
            <div className="max-w-xl">
              <p className="text-h4 text-ink-900">Nie masz jeszcze aktywnej ściągi</p>
              <p className="mt-2 text-ui text-ink-700">
                Ściąga rozbija promocję na kroki i miesiące, pokazuje, co już zrobiłeś/aś, i odblokowuje kolejne
                miesiące dopiero wtedy, gdy faktycznie nadejdą. Wybierz promocję, otwórz konto w banku i zapisz
                promocję w ściądze.
              </p>
              <ButtonLink href="/promocje" className="mt-5">
                Zobacz promocje
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="outline-none">
        Twoje ściągi z promocji
      </h2>
      <p className="mt-2 max-w-2xl text-ui text-ink-700">
        Zaznaczaj kroki w miarę spełniania warunków promocji, którą aktywnie śledzisz. Zaznaczenie możesz w każdej
        chwili cofnąć.
      </p>

      {/* Always in the DOM so that a message appearing later is announced. */}
      <div role="status" className="empty:hidden">
        {successMessage && (
          <div
            className={cn(
              "mt-4 flex items-start gap-3 rounded-card border border-line p-4",
              messageKind === "error" ? "bg-coral-100" : "bg-success-100"
            )}
          >
            {messageKind === "error" ? (
              <AlertCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-coral-600" />
            ) : (
              <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            )}
            <p className="text-ui text-ink-900">{successMessage}</p>
          </div>
        )}
      </div>

      {visible.length === 0 && (
        <ButtonLink href="/promocje" variant="secondary" className="mt-4">
          Zobacz aktualne promocje
        </ButtonLink>
      )}

      <div className="mt-6 space-y-6">
        {visible.map((t) => (
          <ChecklistCard
            key={t.id}
            tracking={t}
            checked={checked}
            failedStepId={failedStepId}
            onToggleStep={toggleStep}
            onToggleMonth={toggleMonth}
            confirming={confirmingId === t.id}
            onRequestConfirm={() => requestConfirm(t)}
            onCancelConfirm={() => setConfirmingId(null)}
            closedAt={closedAtDrafts[t.id] ?? warsawToday()}
            onClosedAtChange={(v) => setClosedAtDrafts((prev) => ({ ...prev, [t.id]: v }))}
            onConfirm={() => complete(t)}
            pending={pending === t.id}
          />
        ))}
      </div>
    </section>
  );
}

function ChecklistCard({
  tracking,
  checked,
  failedStepId,
  onToggleStep,
  onToggleMonth,
  confirming,
  onRequestConfirm,
  onCancelConfirm,
  closedAt,
  onClosedAtChange,
  onConfirm,
  pending
}: {
  tracking: Tracking;
  checked: Set<string>;
  failedStepId: string | null;
  onToggleStep: (stepId: string, next: boolean) => void;
  onToggleMonth: (actionSteps: Step[], allChecked: boolean) => void;
  confirming: boolean;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  closedAt: string;
  onClosedAtChange: (v: string) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const progressLabelId = `${baseId}-progress`;
  const closedAtId = `${baseId}-closed-at`;
  const closedAtHintId = `${baseId}-closed-at-hint`;
  const confirmTitleId = `${baseId}-confirm`;

  const groups = useMemo(
    () => buildGroups(tracking.steps, tracking.accountOpenedAt ? new Date(tracking.accountOpenedAt) : null),
    [tracking.steps, tracking.accountOpenedAt]
  );

  // Steps this participant is actually required to do (a step for a sub-offer
  // they joined too late for is not counted, a step of unknown eligibility is
  // optional).
  const requiredSteps = groups.flatMap((g) => g.requiredSteps);
  const checkedActionCount = requiredSteps.filter((s) => checked.has(s.id)).length;
  const earnedCents = groups.reduce((sum, g) => sum + (isRewardEarned(g, checked) ? g.rewardStep!.rewardCents ?? 0 : 0), 0);
  const progress = requiredSteps.length > 0 ? checkedActionCount / requiredSteps.length : 0;
  const anyLocked = groups.some((g) => !g.unlocked);

  // The check-in animation plays only for a box the user has just ticked.
  const [justTickedId, setJustTickedId] = useState<string | null>(null);

  // Keep the keyboard user oriented when the confirmation panel opens/closes.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirming) dateRef.current?.focus();
    else if (wasConfirming.current) triggerRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  return (
    <article aria-labelledby={titleId} className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <BankLogo name={tracking.bankName} logoUrl={tracking.bankLogoUrl} size="md" />
          <div className="min-w-0">
            <p id={titleId} className="text-h4 text-ink-900">
              {tracking.bankName} — {tracking.promotionName}
            </p>
            <p className="mt-0.5 text-small text-ink-700">
              Zdobyte dotąd: <span className="num font-semibold text-ink-900">{formatPLN(earnedCents)}</span>
            </p>
          </div>
        </div>
        <Link
          href={`/promocje/${tracking.promotionSlug}`}
          className="link-inline inline-flex min-h-11 items-center gap-1 text-small font-medium"
        >
          Zobacz promocję
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      {tracking.fees ? (
        <section aria-label="Darmowe konto i karta" className="mt-5 rounded-field border border-line bg-sunken p-4">
          <h3 className="text-small font-semibold text-ink-900">Darmowe konto i karta</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-2 text-small text-ink-700 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-ink-900">Konto</dt>
              <dd>{tracking.fees.account}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-900">Karta</dt>
              <dd>{tracking.fees.card}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {requiredSteps.length > 0 && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3 text-small">
            <span id={progressLabelId} className="font-semibold text-ink-900">
              Postęp
            </span>
            <span className="num text-ink-700">{stepsOf(checkedActionCount, requiredSteps.length)}</span>
          </div>
          <div
            role="progressbar"
            aria-labelledby={progressLabelId}
            aria-valuemin={0}
            aria-valuemax={requiredSteps.length}
            aria-valuenow={checkedActionCount}
            aria-valuetext={stepsOf(checkedActionCount, requiredSteps.length)}
            className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-teal-500 transition-transform duration-reveal ease-out"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        </div>
      )}

      {!tracking.accountOpenedAt && <OpenedAtPrompt trackingId={tracking.id} />}

      {/* Month groups: 1 column on phones, 2 from md, 3 from lg - no horizontal scroll at any width. */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const monthAllChecked = g.bulkSteps.length > 0 && g.bulkSteps.every((s) => checked.has(s.id));
          const rewardEarned = isRewardEarned(g, checked);
          const monthDone = g.requiredSteps.filter((s) => checked.has(s.id)).length;
          const headingId = `${baseId}-m${g.groupIndex}`;
          const lockId = `${baseId}-m${g.groupIndex}-lock`;
          const failedHere = failedStepId !== null && g.visibleSteps.some((s) => s.id === failedStepId);
          return (
            <div
              key={g.groupIndex}
              role="group"
              aria-labelledby={headingId}
              data-unlocked={g.unlocked ? "true" : "false"}
              className={cn(
                "flex flex-col rounded-card border border-line p-4",
                g.unlocked ? "bg-surface" : "bg-sunken"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 id={headingId} className="text-h4">
                  {g.label}
                </h3>
                {g.requiredSteps.length > 0 && (
                  <span className="num shrink-0 pt-0.5 text-small text-ink-700">
                    <span className="sr-only">Zaznaczone: </span>
                    {monthDone}/{g.requiredSteps.length}
                  </span>
                )}
              </div>

              {!g.unlocked && (
                <p id={lockId} className="mt-1.5 flex items-start gap-1.5 text-small text-ink-700">
                  <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span suppressHydrationWarning>
                    {g.unlockDate
                      ? `Odblokuje się ${formatDate(g.unlockDate)}`
                      : "Odblokuje się po podaniu daty otwarcia konta"}
                  </span>
                </p>
              )}

              {g.unlocked && g.bulkSteps.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => onToggleMonth(g.bulkSteps, monthAllChecked)}
                  className="mt-3 self-start px-4"
                >
                  {monthAllChecked ? "Cofnij zaznaczenie" : "Zaznacz cały miesiąc"}
                </Button>
              )}

              <ul className="-mx-2 mt-2 space-y-0.5">
                {g.visibleSteps.map((s) => {
                  const isChecked = checked.has(s.id);
                  const unknown = g.unknownSteps.includes(s);
                  const inputId = `${baseId}-s-${s.id}`;
                  const noteId = `${inputId}-note`;
                  const describedBy = [!g.unlocked ? lockId : null, unknown ? noteId : null].filter(Boolean).join(" ");
                  return (
                    <li key={s.id}>
                      <label
                        htmlFor={inputId}
                        className={cn(
                          "flex min-h-[3.25rem] items-start gap-3 rounded-field px-2 py-3",
                          g.unlocked ? "cursor-pointer hover:bg-sunken" : "cursor-not-allowed"
                        )}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={isChecked}
                          aria-disabled={!g.unlocked || undefined}
                          aria-describedby={describedBy || undefined}
                          onChange={() => {
                            if (!g.unlocked) return;
                            setJustTickedId(isChecked ? null : s.id);
                            onToggleStep(s.id, !isChecked);
                          }}
                          className={cn(
                            "checkbox",
                            "aria-disabled:cursor-not-allowed aria-disabled:border-line-strong aria-disabled:bg-ink-100",
                            "aria-disabled:checked:border-ink-500 aria-disabled:checked:bg-ink-500",
                            isChecked && justTickedId === s.id && "animate-check-in"
                          )}
                        />
                        <span
                          className={cn(
                            "text-[17px] leading-6",
                            isChecked ? "text-ink-500" : g.unlocked ? "text-ink-900" : "text-ink-700"
                          )}
                        >
                          {s.title}
                        </span>
                      </label>
                      {unknown && (
                        <p id={noteId} className="px-2 pb-2 pl-[2.75rem] text-caption text-ink-500">
                          Opcjonalny: nie mamy daty otwarcia konta, więc nie wiemy, czy ten bonus Ci przysługuje.
                          Zaznacz, tylko jeśli faktycznie z niego korzystasz.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Save errors of this month; the region stays in the DOM so the message is announced. */}
              <div role="status" className="empty:hidden">
                {failedHere && (
                  <p className="mt-2 flex items-start gap-1.5 text-caption font-medium text-coral-600">
                    <AlertCircle size={16} aria-hidden="true" className="mt-px shrink-0" />
                    <span>
                      Nie udało się zapisać zmiany, więc cofnęliśmy zaznaczenie. Sprawdź połączenie i spróbuj
                      ponownie.
                    </span>
                  </p>
                )}
              </div>

              {g.rewardStep && <RewardRow title={g.rewardStep.title} unlocked={rewardEarned} stage={!g.isMonth} />}
            </div>
          );
        })}
      </div>

      {anyLocked && (
        <p className="mt-4 text-caption text-ink-500">
          Kolejne miesiące odblokowują się z upływem czasu, licząc od daty otwarcia konta - kroków z przyszłości nie
          da się zaznaczyć wcześniej.
        </p>
      )}

      <div className="mt-6 border-t border-line pt-5">
        {!confirming ? (
          <Button ref={triggerRef} onClick={onRequestConfirm} fullWidth>
            Spełniłem/am warunki — zamknąłem/am konto
          </Button>
        ) : (
          <div
            role="group"
            aria-labelledby={confirmTitleId}
            className="rounded-card border border-gold-500 bg-gold-100 p-4"
          >
            <p id={confirmTitleId} className="text-ui font-semibold text-ink-900">
              Na pewno? Poniższa data zostanie zapisana jako data zamknięcia Twojego konta {tracking.bankName} (
              {tracking.accountTypeLabel}) w okresach karencji poniżej. Nie musisz mieć zaznaczonych wszystkich
              kroków — jeśli części premii nie udało Ci się zdobyć, to normalne.
            </p>
            <div className="mt-4 max-w-xs">
              <Label htmlFor={closedAtId}>Data zamknięcia konta</Label>
              <Input
                ref={dateRef}
                id={closedAtId}
                type="date"
                value={closedAt}
                onChange={(e) => onClosedAtChange(e.target.value)}
                aria-describedby={closedAtHintId}
              />
            </div>
            <p id={closedAtHintId} className="mt-1.5 max-w-prose text-caption text-ink-700">
              Jeśli obowiązuje Cię okres wypowiedzenia, wpisz przewidywaną/faktyczną datę zamknięcia konta — nie musi
              to być dzisiejsza data.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={onConfirm} loading={pending}>
                {pending ? "Zapisywanie..." : "Tak, potwierdzam"}
              </Button>
              <Button variant="secondary" onClick={onCancelConfirm} disabled={pending}>
                Anuluj
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Older ściągi were started before the opening date was asked for. Without it
 * we can't tell which months are open or whether a sub-offer with its own
 * deadline (e.g. Kantor at Erste) applies, so the owner can supply the real
 * date once. Existing ticks stay exactly as they are; the server refuses
 * future/invalid dates and never overwrites a date that is already saved.
 */
function OpenedAtPrompt({ trackingId }: { trackingId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseId = useId();
  const inputId = `${baseId}-date`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/checklist/opened-at", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingId, accountOpenedAt: value })
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setSaving(false);
    if (!res || !res.ok) {
      setError(data?.error ?? "Nie udało się zapisać daty.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-5 rounded-card border border-gold-500 bg-gold-100 p-4" data-testid="opened-at-prompt">
      <p className="text-ui font-semibold text-ink-900">Podaj datę otwarcia konta</p>
      <p id={hintId} className="mt-1 max-w-2xl text-small text-ink-700">
        Tę ściągę założyłeś/aś, zanim pytaliśmy o datę otwarcia konta. Bez niej nie wiemy, które miesiące są już
        dostępne ani czy przysługują Ci bonusy z własnym terminem zapisu. Wpisz rzeczywistą datę, kiedy otworzyłeś/aś
        konto — Twoje zaznaczenia zostaną zachowane. Datę można zapisać tylko raz.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Label htmlFor={inputId}>Data otwarcia konta</Label>
          <Input
            id={inputId}
            type="date"
            value={value}
            max={warsawToday()}
            onChange={(e) => setValue(e.target.value)}
            invalid={Boolean(error)}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          />
        </div>
        <Button onClick={save} loading={saving} disabled={!value}>
          {saving ? "Zapisywanie..." : "Zapisz datę"}
        </Button>
      </div>
      <FormMessage id={errorId}>{error}</FormMessage>
    </div>
  );
}

/** `stage`: the group is not one calendar month (opening, a window from the agreement date, an aggregate reward), so "ten etap" instead of "ten miesiąc". */
function RewardRow({ title, unlocked, stage = false }: { title: string; unlocked: boolean; stage?: boolean }) {
  const [pop, setPop] = useState(false);
  const prevUnlocked = useRef(unlocked);

  useEffect(() => {
    if (unlocked && !prevUnlocked.current) {
      setPop(true);
      const timeout = setTimeout(() => setPop(false), 600);
      return () => clearTimeout(timeout);
    }
    prevUnlocked.current = unlocked;
  }, [unlocked]);

  const label = title.replace(/^Odbierz( nagrodę)?:\s*/i, "");

  return (
    <div
      data-reward={unlocked ? "unlocked" : "locked"}
      className={cn(
        "relative mt-3 flex items-start gap-3 rounded-field border p-3",
        unlocked ? "border-gold-500 bg-gold-100" : "border-dashed border-line-strong",
        pop && "animate-ring-pulse"
      )}
    >
      <Gift size={20} aria-hidden="true" className={cn("mt-0.5 shrink-0", unlocked ? "text-gold-600" : "text-ink-400")} />
      <div className="min-w-0">
        <p className={cn("text-caption font-semibold", unlocked ? "text-gold-600" : "text-ink-700")}>
          {unlocked ? "Nagroda zdobyta" : stage ? "Nagroda za ten etap" : "Nagroda za ten miesiąc"}
        </p>
        <p
          className={cn(
            "num break-words text-h4",
            unlocked ? "font-display text-gold-600" : "text-ink-700"
          )}
        >
          {label}
        </p>
        {!unlocked && (
          <p className="mt-0.5 text-caption text-ink-500">Odblokuje się po zaznaczeniu wszystkich kroków {stage ? "tego etapu" : "tego miesiąca"}.</p>
        )}
      </div>
    </div>
  );
}
