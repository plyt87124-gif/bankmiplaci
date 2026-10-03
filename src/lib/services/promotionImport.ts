/**
 * Bulk promotion import (the logic behind `npm run import:promotions`), kept
 * in the library so it can be tested against a real database.
 *
 * Guarantees:
 *  - ALL-OR-NOTHING: every entry is planned (read-only) first; if anything is
 *    wrong the import throws ImportAbortError before a single write, and the
 *    whole run - planning and writing - is one transaction, so a failure part-way
 *    through cannot leave a half-imported file either.
 *  - A bonus part's stored sign-up deadline (BonusPart.availableUntil) survives
 *    a re-import. The importer deletes and recreates the parts, so without
 *    care an omitted field would silently erase the boundary (and reopen a
 *    closed reward to new participants). See resolveBonusParts.
 *  - contentUpdatedAt moves only if the page content really changes: stored
 *    state is compared with the EFFECTIVE state after the write (fields the
 *    import leaves alone - additionalSourceUrls, description, waiver
 *    conditions, fees.sourceUrl, ... - are kept in the comparison).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { feeWaiverProblems } from "@/lib/feeValidation";
import { overlayDefined, promotionContentChanged, type PromotionContentLike } from "@/lib/promotionContent";

export interface ImportBank {
  name: string;
  slug: string;
  website?: string | null;
  logoUrl?: string | null;
}

export interface ImportCondition {
  title: string;
  description?: string | null;
  type: string;
  order: number;
}

export interface ImportBonusPart {
  label: string;
  amountCents: number;
  order: number;
  /**
   * Last day (YYYY-MM-DD) a new participant can join this reward's sub-offer.
   *   omitted  -> keep the stored value when the part can be matched unambiguously
   *   null     -> explicitly remove the deadline
   *   "date"   -> set it
   */
  availableUntil?: string | null;
}

export interface ImportFees {
  accountFeeCents?: number | null;
  accountFeeWaiverCondition?: string | null;
  cardFeeCents?: number | null;
  cardFeeWaiverCondition?: string | null;
  atmFeeCents?: number | null;
  otherFee?: string | null;
  sourceUrl?: string | null;
}

const importFeesSchema = z.object({
  accountFeeCents: z.number().int().min(0).nullable().optional(),
  accountFeeWaiverCondition: z.string().trim().nullable().optional(),
  cardFeeCents: z.number().int().min(0).nullable().optional(),
  cardFeeWaiverCondition: z.string().trim().nullable().optional(),
  atmFeeCents: z.number().int().min(0).nullable().optional(),
  otherFee: z.string().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional()
});

/** Omitted fields preserve stored data; on creation an unknown amount stays NULL. */
export function resolveImportFees(slug: string, stored: ImportFees | null | undefined, incoming: unknown) {
  const parsed = importFeesSchema.safeParse(incoming === undefined ? {} : incoming);
  if (!parsed.success) return { fees: {} as ImportFees, updates: {} as ImportFees, problems: parsed.error.issues.map((i) => `${slug}: fees.${i.path.join(".")}: ${i.message}`) };
  const fields = Object.keys(importFeesSchema.shape) as (keyof ImportFees)[];
  const base = Object.fromEntries(fields.map((key) => [key, stored?.[key] ?? null])) as ImportFees;
  const fees = overlayDefined(base, parsed.data);
  return { fees, updates: parsed.data, problems: feeWaiverProblems(fees).map((p) => `${slug}: fees.${p.field}: ${p.message}`) };
}

export interface ImportPromotion {
  slug: string;
  name: string;
  accountType: string;
  maxBonusCents: number;
  difficulty: string;
  // Placeholder; overwritten by recomputeRatings() after the import for any
  // ACTIVE promotion unless ratingOverride is set.
  rating: number;
  ratingOverride?: number | null;
  ratingReason?: string | null;
  status: string;
  startDate: string;
  endDate: string;
  affiliateUrl: string;
  /** Omit to leave an existing promotion's flag untouched (new ones default to true). */
  affiliateLinkEnabled?: boolean;
  sourceUrl?: string | null;
  lastVerifiedAt: string;
  eligibleFor?: string | null;
  notEligibleFor?: string | null;
  cooldownMonths?: number | null;
  cooldownCutoffDate?: string | null;
  summary?: string | null;
  conditions: ImportCondition[];
  bonusParts: ImportBonusPart[];
  fees?: ImportFees;
}

export interface ImportEntry {
  _comment?: string;
  bank: ImportBank;
  promotion: ImportPromotion;
}

export class ImportAbortError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Import przerwany przed jakąkolwiek zmianą w bazie:\n- ${problems.join("\n- ")}`);
    this.name = "ImportAbortError";
  }
}

export interface ResolvedBonusPart {
  label: string;
  amountCents: number;
  order: number;
  availableUntil: Date | null;
}

const norm = (label: string) => label.trim();
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Decide each incoming bonus part's availableUntil.
 * Explicit value in the file (a date, or null) always wins. When the field is
 * OMITTED it is inherited from the stored part with the same label - but only
 * if that match is unambiguous (exactly one stored and one imported part with
 * the label). An ambiguous match, or a stored deadline that would be deleted
 * because its label is no longer in the file, is a problem and aborts the
 * import: silently dropping a deadline is the failure this exists to prevent.
 */
export function resolveBonusParts(
  slug: string,
  existing: { label: string; availableUntil: Date | null }[],
  incoming: ImportBonusPart[]
): { parts: ResolvedBonusPart[]; problems: string[] } {
  const problems: string[] = [];
  const parts: ResolvedBonusPart[] = incoming.map((inc) => {
    let availableUntil: Date | null = null;
    if (inc.availableUntil === null) {
      availableUntil = null; // explicit removal
    } else if (typeof inc.availableUntil === "string") {
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(inc.availableUntil) ? new Date(`${inc.availableUntil}T00:00:00Z`) : new Date(NaN);
      // round-trip check rejects impossible calendar days such as 2026-02-31
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== inc.availableUntil) {
        problems.push(`${slug}: bonus part "${inc.label}" has an invalid availableUntil "${inc.availableUntil}" (expected YYYY-MM-DD or null)`);
      } else {
        availableUntil = parsed;
      }
    } else {
      // omitted -> inherit if, and only if, the match is unambiguous
      const stored = existing.filter((e) => norm(e.label) === norm(inc.label));
      const imported = incoming.filter((i) => norm(i.label) === norm(inc.label));
      if (stored.length === 1 && imported.length === 1) {
        availableUntil = stored[0]!.availableUntil;
      } else if (stored.some((e) => e.availableUntil)) {
        problems.push(
          `${slug}: bonus part "${inc.label}" has a stored deadline but cannot be matched unambiguously ` +
            `(${stored.length} stored, ${imported.length} in the file) - set availableUntil explicitly (YYYY-MM-DD or null)`
        );
      }
    }
    return { label: inc.label, amountCents: inc.amountCents, order: inc.order, availableUntil };
  });

  for (const e of existing) {
    if (e.availableUntil && !incoming.some((i) => norm(i.label) === norm(e.label))) {
      problems.push(
        `${slug}: stored bonus part "${e.label}" (availableUntil ${iso(e.availableUntil)}) is not in the file - the import would delete ` +
          `it together with its deadline. Keep it in the file (with availableUntil) or remove it in the admin panel.`
      );
    }
  }
  return { parts, problems: [...new Set(problems)] };
}

type ExistingPromotion = Prisma.PromotionGetPayload<{ include: { conditions: true; bonusParts: true; fees: true } }>;

interface Plan {
  entry: ImportEntry;
  existing: ExistingPromotion | null;
  parts: ResolvedBonusPart[];
  fees: ImportFees;
  feeUpdates: ImportFees;
}

function baseDataFor(p: ImportPromotion, bankId: string): Prisma.PromotionUncheckedCreateInput {
  return {
    bankId,
    slug: p.slug,
    name: p.name,
    accountType: p.accountType as never,
    maxBonusCents: p.maxBonusCents,
    difficulty: p.difficulty as never,
    rating: p.ratingOverride ?? p.rating,
    ratingOverride: p.ratingOverride ?? undefined,
    ratingReason: p.ratingReason ?? undefined,
    status: p.status as never,
    startDate: new Date(p.startDate),
    endDate: new Date(p.endDate),
    affiliateUrl: p.affiliateUrl,
    affiliateLinkEnabled: p.affiliateLinkEnabled ?? undefined,
    sourceUrl: p.sourceUrl ?? undefined,
    lastVerifiedAt: new Date(p.lastVerifiedAt),
    eligibleFor: p.eligibleFor ?? undefined,
    notEligibleFor: p.notEligibleFor ?? undefined,
    cooldownMonths: p.cooldownMonths ?? undefined,
    cooldownCutoffDate: p.cooldownCutoffDate ? new Date(p.cooldownCutoffDate) : undefined,
    summary: p.summary ?? undefined
  };
}

export async function importPromotions(
  client: PrismaClient,
  entries: ImportEntry[],
  log: (message: string) => void = () => {}
): Promise<{ created: number; updated: number; contentChanged: number }> {
  return client.$transaction(
    async (tx) => {
      // ---- phase 1: plan every entry, read-only -------------------------------------------
      const plans: Plan[] = [];
      const problems: string[] = [];
      const seenSlugs = new Set<string>();
      for (const entry of entries) {
        if (!entry.bank?.slug || !entry.promotion?.slug) {
          log(`Pominięto wpis bez bank.slug lub promotion.slug: ${entry._comment ?? "(bez opisu)"}`);
          continue;
        }
        if (seenSlugs.has(entry.promotion.slug)) {
          problems.push(`${entry.promotion.slug}: duplicate slug in one import`);
          continue;
        }
        seenSlugs.add(entry.promotion.slug);
        const existing = await tx.promotion.findUnique({
          where: { slug: entry.promotion.slug },
          include: { conditions: true, bonusParts: true, fees: true }
        });
        const resolved = resolveBonusParts(
          entry.promotion.slug,
          (existing?.bonusParts ?? []).map((b) => ({ label: b.label, availableUntil: b.availableUntil })),
          entry.promotion.bonusParts
        );
        problems.push(...resolved.problems);
        const resolvedFees = resolveImportFees(entry.promotion.slug, existing?.fees, entry.promotion.fees);
        problems.push(...resolvedFees.problems);
        plans.push({ entry, existing, parts: resolved.parts, fees: resolvedFees.fees, feeUpdates: resolvedFees.updates });
      }
      if (problems.length > 0) throw new ImportAbortError(problems);

      // ---- phase 2: write (same transaction: any failure rolls everything back) ----------
      let created = 0;
      let updated = 0;
      let contentChangedCount = 0;
      for (const { entry, existing, parts, fees, feeUpdates } of plans) {
        const p = entry.promotion;
        const bank = await tx.bank.upsert({
          where: { slug: entry.bank.slug },
          update: {
            name: entry.bank.name,
            website: entry.bank.website ?? undefined,
            logoUrl: entry.bank.logoUrl ?? undefined
          },
          create: {
            name: entry.bank.name,
            slug: entry.bank.slug,
            website: entry.bank.website ?? undefined,
            logoUrl: entry.bank.logoUrl ?? undefined
          }
        });
        const baseData = baseDataFor(p, bank.id);

        if (!existing) {
          await tx.promotion.create({
            data: {
              ...baseData,
              contentUpdatedAt: new Date(),
              conditions: { create: p.conditions },
              bonusParts: { create: parts },
              fees: { create: fees }
            }
          });
          created += 1;
          contentChangedCount += 1;
          continue;
        }

        // Effective state after this write: stored state overlaid with exactly the
        // keys Prisma will set (undefined = skipped = kept).
        const effective: PromotionContentLike = {
          ...overlayDefined(existing as unknown as PromotionContentLike, baseData as unknown as Record<string, unknown>),
          conditions: p.conditions,
          bonusParts: parts,
          fees
        };
        const changed = promotionContentChanged(existing as unknown as PromotionContentLike, effective);

        await tx.promotionCondition.deleteMany({ where: { promotionId: existing.id } });
        await tx.bonusPart.deleteMany({ where: { promotionId: existing.id } });
        await tx.promotion.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            ...(changed ? { contentUpdatedAt: new Date() } : {}),
            conditions: { create: p.conditions },
            bonusParts: { create: parts },
            fees: { upsert: { create: fees, update: feeUpdates } }
          }
        });
        updated += 1;
        if (changed) contentChangedCount += 1;
      }
      return { created, updated, contentChanged: contentChangedCount };
    },
    // A concurrent edit after planning must abort, not invalidate validation or
    // overwrite a later admin save. Caller can inspect the conflict and rerun.
    { timeout: 120_000, maxWait: 20_000, isolationLevel: "Serializable" }
  );
}
