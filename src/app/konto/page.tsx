import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { getCurrentUser } from "@/lib/userSession";
import { db } from "@/lib/db";
import { upsertBankHistory, deleteBankHistoryEntry } from "./actions";
import { LogoutButton } from "./LogoutButton";
import { ACCOUNT_TYPE_LABEL, formatDatePL } from "@/lib/format";
import { PromotionChecklist } from "@/components/PromotionChecklist";
import { EarningsProvider } from "@/components/EarningsContext";
import { EarningsCounter } from "@/components/EarningsCounter";
import { earnedCentsFor } from "@/lib/checklistAvailability";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const TRACKED_ACCOUNT_TYPES = ["PERSONAL", "BUSINESS"] as const;

export default async function AccountPage(props: { searchParams: Promise<{ onboarding?: string }> }) {
  const searchParams = await props.searchParams;
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
      include: { promotion: { include: { checklistSteps: { select: { id: true, order: true, rewardCents: true, availableUntil: true } } } } }
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

  // Same availability rules as the live ściąga (checklistAvailability.ts):
  // a reward that depends on a sub-offer the user joined too late for, or
  // whose eligibility can't be established, is not counted.
  const completedEarnedCents = completedTrackingRows.reduce(
    (sum, t) => sum + earnedCentsFor(t.promotion.checklistSteps, t.accountOpenedAt, checkedStepIds),
    0
  );

  return (
    // Wide container: the ściąga lays its months out in up to 3 columns. Text
    // blocks keep their own readable max width.
    <div className="container-page py-10 sm:py-14">
      <EarningsProvider>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          {/* Lifetime earnings badge sits next to the user's own info, not
              next to the logout button — the live number is computed
              inside PromotionChecklist and pushed up here via
              EarningsProvider. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-4">
            <div className="min-w-0">
              <h1>{isOnboarding ? "Witaj! Jeszcze jedna rzecz" : "Moje konto"}</h1>
              <p className="mt-1 break-words text-small text-ink-500">{user.email}</p>
            </div>
            <EarningsCounter />
          </div>
          {!isOnboarding && <LogoutButton />}
        </div>

        <PromotionChecklist
          trackings={trackings}
          initialChecked={initialChecked}
          completedEarnedCents={completedEarnedCents}
          emptyState={!isOnboarding}
        />
      </EarningsProvider>

      <section aria-labelledby="historia-bankowa" className="mt-12 max-w-3xl">
        <h2 id="historia-bankowa">Twoja historia bankowa</h2>
        <p className="mt-2 max-w-2xl text-ui text-ink-700">
          Dla banków, w których byłeś/aś klientem, podaj typ konta i datę jego zamknięcia — pokażemy Ci wtedy,
          czy minął okres karencji dla promocji tego samego typu konta.
        </p>

        <form
          action={upsertBankHistory}
          className="mt-5 grid gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5"
        >
          <Field label="Bank" required className="sm:col-span-2">
            {(control) => (
              <Select name="bankId" {...control}>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Typ konta">
            {(control) => (
              <Select name="accountType" {...control}>
                {TRACKED_ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Data zamknięcia"
            required
            hint="Jeśli obowiązywał okres wypowiedzenia, wpisz datę faktycznego zamknięcia."
          >
            {(control) => <Input type="date" name="wasClientUntil" {...control} />}
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Dodaj do historii</Button>
          </div>
        </form>

        {history.length > 0 && (
          <ul role="list" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {history.map((e) => {
              const entryBank = bankName.get(e.bankId) ?? "Nieznany bank";
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-card border border-line bg-surface py-2 pl-4 pr-2"
                >
                  <div className="min-w-0">
                    <p className="break-words text-ui font-semibold text-ink-900">{entryBank}</p>
                    <p className="text-small text-ink-500">
                      {ACCOUNT_TYPE_LABEL[e.accountType]} · do {e.wasClientUntil ? formatDatePL(e.wasClientUntil) : "Brak danych"}
                    </p>
                  </div>
                  <form action={deleteBankHistoryEntry.bind(null, e.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      aria-label={`Usuń wpis: ${entryBank}, ${ACCOUNT_TYPE_LABEL[e.accountType]}`}
                      className="h-11 w-11 shrink-0 px-0 text-ink-500 hover:bg-coral-100 hover:text-coral-600"
                    >
                      <X size={20} aria-hidden="true" />
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isOnboarding && (
        <div className="mt-10 flex max-w-3xl flex-col gap-3 sm:flex-row">
          <ButtonLink href="/" variant="secondary" className="flex-1">
            Nie byłem/am klientem żadnego banku
          </ButtonLink>
          <ButtonLink href="/" className="flex-1">
            Gotowe
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
