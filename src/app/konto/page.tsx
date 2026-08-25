import Link from "next/link";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { getCurrentUser } from "@/lib/userSession";
import { db } from "@/lib/db";
import { upsertBankHistory, deleteBankHistoryEntry } from "./actions";
import { LogoutButton } from "./LogoutButton";
import { ACCOUNT_TYPE_LABEL, formatDate } from "@/lib/format";
import { PromotionChecklist } from "@/components/PromotionChecklist";
import { groupIndexFromOrder } from "@/lib/checklistSchedule";

const TRACKED_ACCOUNT_TYPES = ["PERSONAL", "BUSINESS"] as const;

export default async function AccountPage({ searchParams }: { searchParams: { onboarding?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/konto/logowanie?redirect=/konto");

  const isOnboarding = searchParams.onboarding === "1";

  const [banks, history, trackingRows, completedTrackingRows, checkedProgress] = await Promise.all([
    db.bank.findMany({ orderBy: { name: "asc" } }),
    db.userBankHistory.findMany({ where: { userId: user.id } }),
    db.userPromotionTracking.findMany({
      where: { userId: user.id, completedAt: null },
      include: { promotion: { include: { bank: true, checklistSteps: { orderBy: { order: "asc" } } } } }
    }),
    // Completed trackings aren't shown as interactive cards anymore, but
    // their already-earned rewards still count toward the lifetime total.
    db.userPromotionTracking.findMany({
      where: { userId: user.id, completedAt: { not: null } },
      include: { promotion: { include: { checklistSteps: { select: { id: true, order: true, rewardCents: true } } } } }
    }),
    db.checklistProgress.findMany({ where: { userId: user.id }, select: { stepId: true } })
  ]);

  const bankName = new Map(banks.map((b) => [b.id, b.name]));
  const trackings = trackingRows.map((t) => ({
    id: t.id,
    promotionId: t.promotion.id,
    promotionSlug: t.promotion.slug,
    promotionName: t.promotion.name,
    bankName: t.promotion.bank.name,
    bankLogoUrl: t.promotion.bank.logoUrl,
    accountTypeLabel: ACCOUNT_TYPE_LABEL[t.promotion.accountType],
    accountOpenedAt: t.accountOpenedAt ? t.accountOpenedAt.toISOString() : null,
    steps: t.promotion.checklistSteps
  }));
  const initialChecked = checkedProgress.map((p) => p.stepId);
  const checkedStepIds = new Set(initialChecked);

  const completedEarnedCents = completedTrackingRows.reduce((sum, t) => {
    const groups = new Map<number, { action: string[]; rewardCents: number | null }>();
    for (const s of t.promotion.checklistSteps) {
      const idx = groupIndexFromOrder(s.order);
      const entry = groups.get(idx) ?? { action: [], rewardCents: null };
      if (s.rewardCents !== null) entry.rewardCents = s.rewardCents;
      else entry.action.push(s.id);
      groups.set(idx, entry);
    }
    for (const g of groups.values()) {
      if (g.action.length > 0 && g.action.every((id) => checkedStepIds.has(id))) {
        sum += g.rewardCents ?? 0;
      }
    }
    return sum;
  }, 0);

  return (
    <div className="container-page max-w-2xl py-14">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {isOnboarding ? "Witaj! Jeszcze jedna rzecz" : "Moje konto"}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{user.email}</p>
        </div>
        {!isOnboarding && <LogoutButton />}
      </div>

      <PromotionChecklist trackings={trackings} initialChecked={initialChecked} completedEarnedCents={completedEarnedCents} />

      <section className="mt-8">
        <p className="text-sm text-ink-500">
          Dla banków, w których byłeś/aś klientem, podaj typ konta i datę jego zamknięcia — pokażemy Ci wtedy,
          czy minął okres karencji dla promocji tego samego typu konta.{" "}
          <span className="text-ink-300">(Jeśli obowiązywał okres wypowiedzenia, wpisz datę faktycznego zamknięcia.)</span>
        </p>

        <form action={upsertBankHistory} className="mt-5 flex flex-wrap items-end gap-3 rounded-xl2 border border-ink-100 bg-surface p-4">
          <div className="flex-1 min-w-[10rem]">
            <label className="text-xs font-medium text-ink-500">Bank</label>
            <select name="bankId" required className="mt-1 w-full rounded-lg border border-ink-100 bg-surface px-2.5 py-2 text-sm text-ink-900">
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500">Typ konta</label>
            <select name="accountType" className="mt-1 rounded-lg border border-ink-100 bg-surface px-2.5 py-2 text-sm text-ink-900">
              {TRACKED_ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500">Data zamknięcia</label>
            <input type="date" name="wasClientUntil" required className="mt-1 rounded-lg border border-ink-100 bg-surface px-2.5 py-2 text-sm text-ink-900" />
          </div>
          <button className="rounded-full bg-ink-solid px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            Dodaj
          </button>
        </form>

        {history.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {history.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-xl2 border border-ink-100 bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{bankName.get(e.bankId)}</p>
                  <p className="text-xs text-ink-500">
                    {ACCOUNT_TYPE_LABEL[e.accountType]} · do {e.wasClientUntil && formatDate(e.wasClientUntil)}
                  </p>
                </div>
                <form action={deleteBankHistoryEntry.bind(null, e.id)}>
                  <button type="submit" aria-label="Usuń" className="shrink-0 rounded-full p-1.5 text-ink-300 hover:bg-coral-100 hover:text-coral-600">
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {isOnboarding && (
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/"
            className="flex-1 rounded-full border border-ink-100 py-2.5 text-center text-sm font-medium text-ink-700 hover:bg-ink-100"
          >
            Nie byłem/am klientem żadnego banku
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-full bg-ink-solid py-2.5 text-center text-sm font-medium text-white hover:bg-teal-700"
          >
            Gotowe
          </Link>
        </div>
      )}
    </div>
  );
}
