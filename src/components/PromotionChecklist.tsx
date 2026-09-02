"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CheckSquare, Square, CheckCircle2, Lock, Building2 } from "lucide-react";
import { formatPLN, formatDate } from "@/lib/format";
import { groupIndexFromOrder, isGroupUnlocked, monthGroupLabel, unlockDateForGroup } from "@/lib/checklistSchedule";
import { useEarningsContext } from "@/components/EarningsContext";

interface Step {
  id: string;
  monthLabel: string;
  title: string;
  rewardCents: number | null;
  order: number;
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
  steps: Step[];
}

interface Group {
  groupIndex: number;
  label: string;
  actionSteps: Step[];
  rewardStep: Step | null;
  unlocked: boolean;
  unlockDate: Date | null;
}

function buildGroups(steps: Step[], accountOpenedAt: Date | null): Group[] {
  const map = new Map<number, Step[]>();
  for (const s of steps) {
    const idx = groupIndexFromOrder(s.order);
    const list = map.get(idx) ?? [];
    list.push(s);
    map.set(idx, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([groupIndex, groupSteps]) => {
      const rewardStep = groupSteps.find((s) => s.rewardCents !== null) ?? null;
      const actionSteps = groupSteps.filter((s) => s.rewardCents === null);
      return {
        groupIndex,
        label: monthGroupLabel(accountOpenedAt, groupIndex, groupSteps[0]?.monthLabel ?? ""),
        actionSteps,
        rewardStep,
        unlocked: isGroupUnlocked(accountOpenedAt, groupIndex),
        unlockDate: accountOpenedAt ? unlockDateForGroup(accountOpenedAt, groupIndex) : null
      };
    });
}

function trackingEarnedCents(tracking: Tracking, checked: Set<string>): number {
  const opened = tracking.accountOpenedAt ? new Date(tracking.accountOpenedAt) : null;
  return buildGroups(tracking.steps, opened).reduce((sum, g) => {
    const allDone = g.actionSteps.length > 0 && g.actionSteps.every((s) => checked.has(s.id));
    return sum + (allDone && g.rewardStep ? g.rewardStep.rewardCents ?? 0 : 0);
  }, 0);
}

export function PromotionChecklist({
  trackings,
  initialChecked,
  completedEarnedCents
}: {
  trackings: Tracking[];
  initialChecked: string[];
  completedEarnedCents: number;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialChecked));
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [closedAtDrafts, setClosedAtDrafts] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

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

  async function toggleStep(stepId: string, next: boolean) {
    setChecked((prev) => {
      const s = new Set(prev);
      if (next) s.add(stepId);
      else s.delete(stepId);
      return s;
    });
    const res = await fetch("/api/checklist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, checked: next })
    }).catch(() => null);
    if (!res || !res.ok) {
      // Server rejected it (e.g. month not unlocked yet) — revert the optimistic check.
      setChecked((prev) => {
        const s = new Set(prev);
        if (next) s.delete(stepId);
        else s.add(stepId);
        return s;
      });
    }
  }

  function toggleMonth(actionSteps: Step[], allChecked: boolean) {
    actionSteps.forEach((s) => toggleStep(s.id, !allChecked));
  }

  function requestConfirm(t: Tracking) {
    setConfirmingId(t.id);
    setClosedAtDrafts((prev) => ({ ...prev, [t.id]: prev[t.id] ?? new Date().toISOString().slice(0, 10) }));
  }

  async function complete(t: Tracking) {
    setPending(t.id);
    const closedAt = closedAtDrafts[t.id] ?? new Date().toISOString().slice(0, 10);
    const res = await fetch("/api/checklist/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionId: t.promotionId, closedAt })
    });
    const data = await res.json().catch(() => null);
    setPending(null);
    setConfirmingId(null);

    if (!res.ok) {
      setSuccessMessage(data?.error ?? "Coś poszło nie tak.");
      return;
    }

    setSuccessMessage(
      `Uzupełniliśmy Twoją datę zamknięcia konta (${t.bankName}, ${t.accountTypeLabel}) w Twoich okresach karencji poniżej. Gdy okres karencji minie, powiadomimy Cię o możliwości skorzystania z kolejnej promocji w tym banku.`
    );
    setDoneIds((prev) => new Set(prev).add(t.id));
    router.refresh();
  }

  return (
    <>
      {(visible.length > 0 || successMessage) && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Twoje ściągi z promocji</h2>
          <p className="mt-1 text-sm text-ink-500">
            Odznaczaj kroki w miarę spełniania warunków promocji, którą aktywnie śledzisz.
          </p>

          {successMessage && (
            <div className="mt-4 flex items-start gap-3 rounded-xl2 border border-teal-100 bg-teal-100/40 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
              <p className="text-sm text-teal-700">{successMessage}</p>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {visible.map((t) => (
              <ChecklistCard
                key={t.id}
                tracking={t}
                checked={checked}
                onToggleStep={toggleStep}
                onToggleMonth={toggleMonth}
                confirming={confirmingId === t.id}
                onRequestConfirm={() => requestConfirm(t)}
                onCancelConfirm={() => setConfirmingId(null)}
                closedAt={closedAtDrafts[t.id] ?? new Date().toISOString().slice(0, 10)}
                onClosedAtChange={(v) => setClosedAtDrafts((prev) => ({ ...prev, [t.id]: v }))}
                onConfirm={() => complete(t)}
                pending={pending === t.id}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ChecklistCard({
  tracking,
  checked,
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
  const accountOpenedAt = tracking.accountOpenedAt ? new Date(tracking.accountOpenedAt) : null;
  const groups = useMemo(() => buildGroups(tracking.steps, accountOpenedAt), [tracking.steps, tracking.accountOpenedAt]);

  const actionSteps = tracking.steps.filter((s) => s.rewardCents === null);
  const checkedActionCount = actionSteps.filter((s) => checked.has(s.id)).length;
  const earnedCents = groups.reduce((sum, g) => {
    const allDone = g.actionSteps.length > 0 && g.actionSteps.every((s) => checked.has(s.id));
    return sum + (allDone && g.rewardStep ? g.rewardStep.rewardCents ?? 0 : 0);
  }, 0);

  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {tracking.bankLogoUrl ? (
            <div className="relative h-9 w-24 shrink-0">
              <Image src={tracking.bankLogoUrl} alt={tracking.bankName} fill sizes="96px" className="object-contain object-left" />
            </div>
          ) : (
            <Building2 className="h-6 w-6 shrink-0 text-ink-400" />
          )}
          <div>
            <p className="font-medium text-ink-900">
              {tracking.bankName} — {tracking.promotionName}
            </p>
            <p className="text-xs text-ink-500">
              {checkedActionCount}/{actionSteps.length} kroków · zdobyte dotąd: {formatPLN(earnedCents)}
            </p>
          </div>
        </div>
        <Link href={`/promocje/${tracking.promotionSlug}`} className="text-xs font-medium text-teal-700 hover:underline">
          Zobacz promocję →
        </Link>
      </div>

      {/* Month groups run left-to-right, top-to-bottom — no horizontal
          scrollbar, they wrap onto further rows instead so the whole
          timeline is visible at once (the page itself still scrolls). */}
      <div className="mt-4 flex flex-wrap gap-4">
        {groups.map((g) => {
          const monthAllChecked = g.actionSteps.length > 0 && g.actionSteps.every((s) => checked.has(s.id));
          return (
            <div key={g.groupIndex} className={`w-72 ${!g.unlocked ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {!g.unlocked && <Lock className="h-3 w-3" />}
                  {g.label}
                </p>
                {g.unlocked ? (
                  <button
                    onClick={() => onToggleMonth(g.actionSteps, monthAllChecked)}
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    {monthAllChecked ? "Odznacz cały miesiąc" : "Zaznacz cały miesiąc"}
                  </button>
                ) : (
                  g.unlockDate && (
                    <span className="text-xs text-ink-300">odblokuje się {formatDate(g.unlockDate)}</span>
                  )
                )}
              </div>
              <ul className="mt-2 space-y-1.5">
                {g.actionSteps.map((s) => {
                  const isChecked = checked.has(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => g.unlocked && onToggleStep(s.id, !isChecked)}
                        disabled={!g.unlocked}
                        className="flex w-full items-start gap-2.5 rounded-lg border border-ink-100 p-2.5 text-left hover:border-teal-500 disabled:cursor-not-allowed disabled:hover:border-ink-100"
                      >
                        {isChecked ? (
                          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                        ) : (
                          <Square className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
                        )}
                        <span className="text-sm text-ink-700">{s.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {g.rewardStep && <RewardRow title={g.rewardStep.title} unlocked={monthAllChecked} />}
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-ink-100 pt-4">
        {!confirming ? (
          <button
            onClick={onRequestConfirm}
            className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            Spełniłem/am warunki — zamknąłem/am konto
          </button>
        ) : (
          <div className="rounded-xl2 border border-gold-600 bg-gold-100/40 p-3">
            <p className="text-sm font-medium text-ink-900">
              Na pewno? Poniższa data zostanie zapisana jako data zamknięcia Twojego konta {tracking.bankName} (
              {tracking.accountTypeLabel}) w okresach karencji poniżej. Nie musisz mieć odznaczonych wszystkich
              kroków — jeśli części premii nie udało Ci się zdobyć, to normalne.
            </p>
            <div className="mt-3">
              <label className="text-xs font-medium text-ink-700">Data zamknięcia konta</label>
              <input
                type="date"
                value={closedAt}
                onChange={(e) => onClosedAtChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink-100 bg-surface px-2.5 py-2 text-sm text-ink-900 outline-none focus:border-teal-500"
              />
              <p className="mt-1 text-[11px] text-ink-500">
                Jeśli obowiązuje Cię okres wypowiedzenia, wpisz przewidywaną/faktyczną datę zamknięcia konta — nie
                musi to być dzisiejsza data.
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onConfirm}
                disabled={pending}
                className="rounded-full bg-ink-solid px-4 py-2 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {pending ? "Zapisywanie..." : "Tak, potwierdzam"}
              </button>
              <button onClick={onCancelConfirm} className="rounded-full border border-ink-100 px-4 py-2 text-xs font-medium text-ink-700">
                Anuluj
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RewardRow({ title, unlocked }: { title: string; unlocked: boolean }) {
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

  return (
    <div
      className={`mt-2 flex items-center gap-2.5 rounded-lg border p-2.5 ${
        unlocked ? "border-gold-600 bg-gold-100/40" : "border-dashed border-ink-100"
      } ${pop ? "animate-reward-pop" : ""}`}
    >
      <span className={`text-sm ${unlocked ? "font-medium text-gold-600" : "text-ink-300"}`}>
        {title.replace(/^Odbierz nagrodę:\s*/i, "")}
      </span>
      {!unlocked && <span className="text-[11px] text-ink-300">— odblokuje się po ukończeniu kroków tego miesiąca</span>}
    </div>
  );
}
