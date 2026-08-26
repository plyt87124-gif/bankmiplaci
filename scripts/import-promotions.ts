/**
 * Bulk-imports promotions from data/new-promotions.json.
 *
 * Run with: npm run import:promotions
 *
 * Safe to re-run: banks are matched/created by slug, promotions are
 * matched/created by slug too, so running this again after editing
 * the JSON (e.g. to fix a typo) just updates the existing rows rather
 * than duplicating them.
 *
 * IMPORTANT — every imported promotion defaults to status "DRAFT"
 * unless the JSON explicitly says "ACTIVE". Review each one in
 * /admin/promocje (check the affiliate link, rating, and dates) before
 * flipping it to Active — this script does not verify affiliate URLs
 * or judge the difficulty/rating for you.
 *
 * Field reference (see prisma/schema.prisma for the authoritative list):
 *   bank.slug            lowercase, letters/numbers/hyphens only, must be unique
 *   promotion.slug        same rules, must be unique across all promotions
 *   maxBonusCents         PLN * 100 as an integer (500 zł -> 50000)
 *   difficulty             "VERY_EASY" | "EASY" | "MEDIUM" | "HARD"
 *   accountType            "PERSONAL" | "SAVINGS" | "YOUNG" | "BUSINESS" | "JOINT"
 *   status                 "DRAFT" | "ACTIVE" | "EXPIRED" | "ARCHIVED"
 *   cooldownMonths          integer months, or null if not applicable
 *   cooldownCutoffDate      "YYYY-MM-DD", or null — use INSTEAD OF or
 *                           ALONGSIDE cooldownMonths, see the promotion
 *                           edit form's helper text for which one fits
 *   conditions[].type      "account_opening" | "card_payments" | "inflow" | "deadline" | "other"
 */
import { PrismaClient, Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";
import { recomputeRatings } from "../src/lib/services/ratings";

const db = new PrismaClient();

interface ImportBank {
  name: string;
  slug: string;
  website?: string | null;
  logoUrl?: string | null;
}

interface ImportCondition {
  title: string;
  description?: string | null;
  type: string;
  order: number;
}

interface ImportBonusPart {
  label: string;
  amountCents: number;
  order: number;
}

interface ImportFees {
  accountFeeCents: number;
  cardFeeCents: number;
  atmFeeCents: number;
  otherFee?: string | null;
}

interface ImportPromotion {
  slug: string;
  name: string;
  accountType: string;
  maxBonusCents: number;
  difficulty: string;
  // Placeholder; overwritten by recomputeRatings() at the end of this
  // script for any ACTIVE promotion unless ratingOverride is set.
  rating: number;
  ratingOverride?: number | null;
  ratingReason?: string | null;
  status: string;
  startDate: string;
  endDate: string;
  affiliateUrl: string;
  sourceUrl?: string | null;
  lastVerifiedAt: string;
  eligibleFor?: string | null;
  notEligibleFor?: string | null;
  cooldownMonths?: number | null;
  cooldownCutoffDate?: string | null;
  summary?: string | null;
  conditions: ImportCondition[];
  bonusParts: ImportBonusPart[];
  fees: ImportFees;
}

interface ImportEntry {
  _comment?: string;
  bank: ImportBank;
  promotion: ImportPromotion;
}

async function main() {
  const filePath = path.join(process.cwd(), "data", "new-promotions.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const entries: ImportEntry[] = JSON.parse(raw);

  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    if (!entry.bank?.slug || !entry.promotion?.slug) {
      console.warn("Pominięto wpis bez bank.slug lub promotion.slug:", entry._comment ?? "(bez opisu)");
      continue;
    }

    const bank = await db.bank.upsert({
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

    const p = entry.promotion;
    const existing = await db.promotion.findUnique({ where: { slug: p.slug } });

    const baseData: Prisma.PromotionUncheckedCreateInput = {
      bankId: bank.id,
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
      sourceUrl: p.sourceUrl ?? undefined,
      lastVerifiedAt: new Date(p.lastVerifiedAt),
      eligibleFor: p.eligibleFor ?? undefined,
      notEligibleFor: p.notEligibleFor ?? undefined,
      cooldownMonths: p.cooldownMonths ?? undefined,
      cooldownCutoffDate: p.cooldownCutoffDate ? new Date(p.cooldownCutoffDate) : undefined,
      summary: p.summary ?? undefined
    };

    if (existing) {
      await db.promotionCondition.deleteMany({ where: { promotionId: existing.id } });
      await db.bonusPart.deleteMany({ where: { promotionId: existing.id } });
      await db.promotion.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          conditions: { create: p.conditions },
          bonusParts: { create: p.bonusParts },
          fees: { upsert: { create: p.fees, update: p.fees } }
        }
      });
      updated += 1;
    } else {
      await db.promotion.create({
        data: {
          ...baseData,
          conditions: { create: p.conditions },
          bonusParts: { create: p.bonusParts },
          fees: { create: p.fees }
        }
      });
      created += 1;
    }
  }

  await recomputeRatings();

  console.log(`Gotowe. Utworzono ${created}, zaktualizowano ${updated} promocji.`);
  console.log("Pamiętaj: nowe promocje mają status z pliku JSON — sprawdź je w /admin/promocje przed publikacją.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
