/**
 * Database side of the verification regime described in src/lib/verification.ts:
 * which offers must be checked, recording a check (the ONLY place besides the
 * admin form/extension script that moves Promotion.lastVerifiedAt), and the
 * watchdog that tells the owner when the daily run left an offer unchecked.
 */
import type { PrismaClient } from "@prisma/client";
import { isDeadlinePassed } from "@/lib/promotionAvailability";
import { isoDatePL } from "@/lib/seo/dates";
import {
  VERIFY_ALERT_HOURS,
  VERIFY_TARGET_HOURS,
  hoursSinceVerified,
  isVerificationOverdue,
  sourceUrlsOf,
  type SourceSnapshot,
  type VerificationMethod,
  type VerificationResult
} from "@/lib/verification";

type Client = Pick<PrismaClient, "promotion" | "promotionVerification" | "adminNotification" | "$transaction">;

export interface OfferToVerify {
  id: string;
  slug: string;
  name: string;
  bankName: string;
  endDate: Date;
  lastVerifiedAt: Date;
  /** The documents the offer rests on (regulamin, extra sources, fee table). */
  sourceUrls: string[];
  /** Documents of the last CONFIRMED check - what "unchanged" is measured against. */
  baseline: SourceSnapshot[] | null;
  lastConfirmedAt: Date | null;
}

function asSnapshots(value: unknown): SourceSnapshot[] | null {
  if (!Array.isArray(value)) return null;
  const out: SourceSnapshot[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object" || typeof (v as SourceSnapshot).url !== "string") return null;
    out.push(v as SourceSnapshot);
  }
  return out;
}

/** Active offers whose sign-up window is still open, oldest verification first. */
export async function offersToVerify(client: Client, now: Date = new Date()): Promise<OfferToVerify[]> {
  const rows = await client.promotion.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ lastVerifiedAt: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      endDate: true,
      lastVerifiedAt: true,
      sourceUrl: true,
      additionalSourceUrls: true,
      bank: { select: { name: true } },
      fees: { select: { sourceUrl: true } },
      verifications: { where: { result: "CONFIRMED" }, orderBy: { checkedAt: "desc" }, take: 1, select: { sources: true, checkedAt: true } }
    }
  });
  return rows
    .filter((r) => !isDeadlinePassed(r.endDate, now))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      bankName: r.bank.name,
      endDate: r.endDate,
      lastVerifiedAt: r.lastVerifiedAt,
      sourceUrls: sourceUrlsOf({ sourceUrl: r.sourceUrl, additionalSourceUrls: r.additionalSourceUrls, feesSourceUrl: r.fees?.sourceUrl }),
      baseline: asSnapshots(r.verifications[0]?.sources),
      lastConfirmedAt: r.verifications[0]?.checkedAt ?? null
    }));
}

export interface RecordVerificationInput {
  promotionId: string;
  result: VerificationResult;
  method: VerificationMethod;
  sources: SourceSnapshot[];
  note?: string | null;
  now?: Date;
}

/**
 * Writes one check. A CONFIRMED check also moves lastVerifiedAt - in the same
 * transaction, so the date and its record cannot diverge. It refuses to confirm
 * on nothing: at least one document, and each one either read (hash) or
 * explicitly attested as read in a browser.
 */
export async function recordVerification(client: Client, input: RecordVerificationInput): Promise<{ id: string; confirmed: boolean }> {
  const now = input.now ?? new Date();
  if (input.result === "CONFIRMED") {
    if (input.sources.length === 0) throw new Error("Nie można potwierdzić oferty bez ani jednego dokumentu źródłowego.");
    const unread = input.sources.filter((s) => !(s.ok && (s.sha256 || s.viaBrowser)));
    if (unread.length > 0) throw new Error(`Nie można potwierdzić oferty: nieodczytane dokumenty: ${unread.map((s) => s.url).join(", ")}.`);
    if (input.method === "REVIEW" && !input.note?.trim()) throw new Error("Weryfikacja ręczna wymaga opisu (--note): co porównano i z czym.");
  }
  const created = await client.$transaction(async (tx) => {
    const row = await tx.promotionVerification.create({
      data: {
        promotionId: input.promotionId,
        checkedAt: now,
        result: input.result,
        method: input.method,
        sources: input.sources as unknown as object,
        note: input.note?.trim() || null
      },
      select: { id: true }
    });
    if (input.result === "CONFIRMED") {
      await tx.promotion.update({ where: { id: input.promotionId }, data: { lastVerifiedAt: now } });
    }
    return row;
  });
  return { id: created.id, confirmed: input.result === "CONFIRMED" };
}

export interface OverdueOffer {
  id: string;
  slug: string;
  name: string;
  bankName: string;
  lastVerifiedAt: Date;
  hours: number;
}

/** Active, still-open offers whose verification is older than `thresholdHours`. */
export async function overdueOffers(client: Client, now: Date = new Date(), thresholdHours: number = VERIFY_ALERT_HOURS): Promise<OverdueOffer[]> {
  const rows = await client.promotion.findMany({
    where: { status: "ACTIVE" },
    orderBy: { lastVerifiedAt: "asc" },
    select: { id: true, slug: true, name: true, endDate: true, lastVerifiedAt: true, bank: { select: { name: true } } }
  });
  return rows
    .filter((r) => !isDeadlinePassed(r.endDate, now) && isVerificationOverdue(r.lastVerifiedAt, now, thresholdHours))
    .map((r) => ({ id: r.id, slug: r.slug, name: r.name, bankName: r.bank.name, lastVerifiedAt: r.lastVerifiedAt, hours: hoursSinceVerified(r.lastVerifiedAt, now) ?? 0 }));
}

/**
 * Watchdog (called by /api/cron/verification-watch): one admin notification per
 * overdue offer per day (dedupKey), returned so the caller can send one e-mail.
 * It changes no offer data.
 */
export async function raiseOverdueNotifications(client: Client, now: Date = new Date()): Promise<{ overdue: OverdueOffer[]; created: OverdueOffer[] }> {
  const overdue = await overdueOffers(client, now);
  const day = isoDatePL(now) ?? now.toISOString().slice(0, 10);
  const created: OverdueOffer[] = [];
  for (const o of overdue) {
    try {
      await client.adminNotification.create({
        data: {
          type: "PROMOTION_CHECK_NEEDED",
          title: `Weryfikacja po terminie: ${o.name}`,
          body: `Ostatnia weryfikacja ${o.hours} h temu (limit ${VERIFY_TARGET_HOURS} h). Codzienne sprawdzanie dokumentów banku nie odświeżyło tej oferty - sprawdź źródła i potwierdź ją.`,
          relatedPromotionId: o.id,
          dedupKey: `verify-overdue:${o.id}:${day}`
        }
      });
      created.push(o);
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // already raised today
    }
  }
  return { overdue, created };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One e-mail for the whole run; null when nothing is overdue (the watchdog is silent on good days). */
export function overdueDigestEmail(overdue: OverdueOffer[], adminUrl: string): { subject: string; html: string } | null {
  if (overdue.length === 0) return null;
  const rows = overdue
    .map((o) => `<li><strong>${esc(o.bankName)} – ${esc(o.name)}</strong><br>ostatnia weryfikacja ${o.hours} h temu (${esc(isoDatePL(o.lastVerifiedAt) ?? "?")})</li>`)
    .join("");
  return {
    subject: `Bankmiplaci: ${overdue.length} ${overdue.length === 1 ? "oferta czeka" : "ofert(y) czeka"} na weryfikację ponad ${VERIFY_ALERT_HOURS} h`,
    html: `<p>Codzienna weryfikacja nie odświeżyła tych ofert w ciągu ${VERIFY_ALERT_HOURS} godzin (obiecujemy czytelnikom najwyżej ${VERIFY_TARGET_HOURS} h):</p><ul>${rows}</ul><p><a href="${esc(adminUrl)}">Otwórz panel admina</a></p><p style="color:#666;font-size:12px">Data „Zweryfikowano” przy ofercie nie przesuwa się sama - po ${VERIFY_TARGET_HOURS} h strona pokaże, że weryfikacja jest nieaktualna.</p>`
  };
}
