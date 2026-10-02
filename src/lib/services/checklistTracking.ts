/**
 * Database-side rules of a user's ściąga (UserPromotionTracking), kept out of
 * the route handlers so they can be tested against a real database.
 *
 *  - setAccountOpenedAt: lets the owner of an older, unfinished ściąga that has
 *    no accountOpenedAt supply the real opening date of the account. Only that
 *    one column is written - id, joinedAt, remindedGroupIndexes and every saved
 *    tick (ChecklistProgress) are untouched. The availability of months, the
 *    Kantor steps and rewards is not stored anywhere; it is derived from
 *    accountOpenedAt on every read (checklistAvailability.ts / checklistSchedule.ts),
 *    so it "recomputes" by itself the moment the date exists.
 *  - joinChecklist: the write behind POST /api/checklist/join. Same date
 *    validation as setAccountOpenedAt (parseAccountOpenedAt), and the same
 *    guarantee that a saved date is never silently replaced: joining again with
 *    the SAME date is a harmless no-op, with a DIFFERENT date it is refused (409).
 *    Only restarting a COMPLETED ściąga (when the lock allows it) sets the date of
 *    a new cycle.
 *  - restart lock: a COMPLETED ściąga can be started again only when the
 *    shared eligibility rule (services/eligibility.ts) says "eligible".
 */
import type { AccountType, PrismaClient } from "@prisma/client";
import { warsawTodayAsUtcMidnight } from "@/lib/promotionAvailability";
import { computeEligibility, isChecklistRestartLocked, type EligibilityResult } from "@/lib/services/eligibility";

/** Earliest account-opening date accepted; guards against typos like 0026-05-01. */
export const OPENED_AT_EARLIEST = "2000-01-01";

export type ParsedOpenedAt = { ok: true; date: Date } | { ok: false; error: string };

/**
 * "YYYY-MM-DD" only, a real calendar day, not later than today in Poland, not
 * before OPENED_AT_EARLIEST. Returned as 00:00 UTC of that day, which is how
 * accountOpenedAt is stored everywhere else (join route) and compared
 * (checklistAvailability.dayKey).
 */
export function parseAccountOpenedAt(raw: unknown, now: Date = new Date()): ParsedOpenedAt {
  const invalid = { ok: false as const, error: "Podaj prawidłową datę otwarcia konta (RRRR-MM-DD)." };
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return invalid;
  const text = raw.trim();
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return invalid;
  if (text < OPENED_AT_EARLIEST) return invalid;
  if (date.getTime() > warsawTodayAsUtcMidnight(now).getTime()) {
    return { ok: false, error: "Data otwarcia konta nie może być z przyszłości." };
  }
  return { ok: true, date };
}

export type SetOpenedAtResult =
  | { ok: true }
  | { ok: false; status: 400 | 404 | 409; error: string };

export async function setAccountOpenedAt(
  client: PrismaClient,
  userId: string,
  trackingId: string,
  raw: unknown,
  now: Date = new Date()
): Promise<SetOpenedAtResult> {
  const parsed = parseAccountOpenedAt(raw, now);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  // Compare-and-set in one statement: only the owner's own, unfinished tracking
  // that still has no date. Someone else's id matches nothing (and is reported
  // exactly like a missing one, so ids can't be probed); a date that is already
  // set is never overwritten here - it gates months and rewards.
  const { count } = await client.userPromotionTracking.updateMany({
    where: { id: trackingId, userId, completedAt: null, accountOpenedAt: null },
    data: { accountOpenedAt: parsed.date }
  });
  if (count === 1) return { ok: true };

  const own = await client.userPromotionTracking.findFirst({
    where: { id: trackingId, userId },
    select: { accountOpenedAt: true, completedAt: true }
  });
  if (!own) return { ok: false, status: 404, error: "Nie znaleziono ściągi." };
  return {
    ok: false,
    status: 409,
    error: own.completedAt ? "Ta ściąga jest już ukończona." : DATE_ALREADY_SAVED_ERROR
  };
}

export type JoinResult =
  | { ok: true; outcome: "created" | "date-saved" | "unchanged" | "restarted" }
  | { ok: false; status: 400 | 404 | 409; error: string };

const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export const LOCKED_ERROR = "Ściąga odblokuje się ponownie po upływie okresu karencji dla tego banku.";
export const DATE_ALREADY_SAVED_ERROR = "Data otwarcia konta jest już zapisana i nie można jej zmienić.";

/**
 * Every write is conditional in the statement itself (no read-then-write gap), so
 * concurrent requests can neither overwrite a saved date nor restart a ściąga twice:
 *   - no tracking yet            -> INSERT (a racing duplicate hits the unique key and
 *                                   is treated as "tracking exists")
 *   - completed tracking         -> lock check, then UPDATE ... WHERE completedAt IS NOT NULL
 *                                   + wipe of that promotion's ticks in one transaction
 *   - unfinished, no date yet    -> UPDATE ... WHERE accountOpenedAt IS NULL AND completedAt IS NULL
 *   - unfinished, date saved     -> same day: no-op success; any other day: 409
 */
export async function joinChecklist(
  client: PrismaClient,
  userId: string,
  promotionId: string,
  rawOpenedAt: unknown,
  now: Date = new Date()
): Promise<JoinResult> {
  const parsed = parseAccountOpenedAt(rawOpenedAt, now);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const date = parsed.date;

  const promotion = await client.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, checklistSteps: { select: { id: true } } }
  });
  if (!promotion) return { ok: false, status: 404, error: "Nie znaleziono promocji." };

  const find = () => client.userPromotionTracking.findUnique({ where: { userId_promotionId: { userId, promotionId } } });
  let existing = await find();

  if (!existing) {
    try {
      await client.userPromotionTracking.create({ data: { userId, promotionId, accountOpenedAt: date } });
      return { ok: true, outcome: "created" };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      existing = await find(); // a concurrent request created it first
    }
  }

  if (existing?.completedAt) {
    // Same lock the promotion page shows: a completed ściąga restarts only once the
    // shared eligibility rule says "eligible".
    const { allowed } = await checklistRestartAllowed(client, userId, promotionId, now);
    if (!allowed) return { ok: false, status: 409, error: LOCKED_ERROR };
    // Restarting a promotion the user already completed once (karencja cleared, or they
    // corrected their bank-history dates): wipe last cycle's ticks so the new round
    // starts at 0, re-open the tracking, set the date of the new cycle and clear the
    // month-deadline reminder markers of the previous cycle (remindedGroupIndexes), so the
    // new cycle's months get their own reminders. Only this branch resets them.
    const restarted = await client.$transaction(async (tx) => {
      const { count } = await tx.userPromotionTracking.updateMany({
        where: { id: existing!.id, userId, completedAt: { not: null } },
        data: { completedAt: null, joinedAt: now, accountOpenedAt: date, remindedGroupIndexes: [] }
      });
      if (count !== 1) return false;
      await tx.checklistProgress.deleteMany({
        where: { userId, stepId: { in: promotion.checklistSteps.map((s) => s.id) } }
      });
      return true;
    });
    if (restarted) return { ok: true, outcome: "restarted" };
    existing = await find(); // restarted by a concurrent request: judge it as an unfinished ściąga
  }

  // Unfinished ściąga: fill an empty date atomically ...
  const { count } = await client.userPromotionTracking.updateMany({
    where: { userId, promotionId, completedAt: null, accountOpenedAt: null },
    data: { accountOpenedAt: date }
  });
  if (count === 1) return { ok: true, outcome: "date-saved" };

  // ... otherwise the date is already saved (or the ściąga was just completed): never replace it.
  const current = await find();
  if (current && !current.completedAt && current.accountOpenedAt && sameDay(current.accountOpenedAt, date)) {
    return { ok: true, outcome: "unchanged" };
  }
  return { ok: false, status: 409, error: current?.completedAt ? LOCKED_ERROR : DATE_ALREADY_SAVED_ERROR };
}

interface PromotionRules {
  bankId: string;
  accountType: AccountType;
  cooldownMonths: number | null;
  cooldownCutoffDate: Date | null;
}

/** Eligibility of this user for this promotion from their own bank history (Moje konto). */
export async function eligibilityForUser(
  client: PrismaClient,
  userId: string,
  promotion: PromotionRules,
  now: Date = new Date()
): Promise<EligibilityResult> {
  const history = await client.userBankHistory.findUnique({
    where: { userId_bankId_accountType: { userId, bankId: promotion.bankId, accountType: promotion.accountType } },
    select: { wasClientUntil: true }
  });
  return computeEligibility(promotion.cooldownMonths, promotion.cooldownCutoffDate, history?.wasClientUntil, now);
}

/**
 * May this user start a fresh round of the promotion's ściąga? A tracking that
 * was never completed is not subject to the lock; a completed one needs a clear
 * "eligible" from the shared rule (no history / no rule / still waiting => no).
 */
export async function checklistRestartAllowed(
  client: PrismaClient,
  userId: string,
  promotionId: string,
  now: Date = new Date()
): Promise<{ allowed: boolean; eligibility: EligibilityResult | null }> {
  const tracking = await client.userPromotionTracking.findUnique({
    where: { userId_promotionId: { userId, promotionId } },
    select: { completedAt: true, promotion: { select: { bankId: true, accountType: true, cooldownMonths: true, cooldownCutoffDate: true } } }
  });
  if (!tracking?.completedAt) return { allowed: true, eligibility: null };
  const eligibility = await eligibilityForUser(client, userId, tracking.promotion, now);
  return { allowed: !isChecklistRestartLocked(tracking.completedAt, eligibility), eligibility };
}
