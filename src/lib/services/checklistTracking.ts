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
    error: own.completedAt
      ? "Ta ściąga jest już ukończona."
      : "Data otwarcia konta jest już zapisana i nie można jej zmienić."
  };
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
