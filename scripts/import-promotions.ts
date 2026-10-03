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
 *   fees.*FeeCents          integer grosze or null (unknown); omitted preserves an
 *                          existing amount, or creates NULL for a new offer
 *   fees.*FeeWaiverCondition condition for waiving the corresponding nonzero rate;
 *                          0 + a condition is rejected before any writes
 *   fees.sourceUrl          verified tariff source (omitted preserves, null clears)
 *   bonusParts[].availableUntil
 *                          "YYYY-MM-DD" = last day a NEW participant can join that
 *                          reward's sub-offer; null = explicitly remove it; OMIT the
 *                          key to keep whatever is stored (matched by label; an
 *                          ambiguous match, or a stored deadline whose label is no
 *                          longer in the file, aborts the whole import untouched)
 *
 * The whole run is one transaction: either everything in the file is applied
 * or nothing is. Logic and tests: src/lib/services/promotionImport.ts.
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { recomputeRatings } from "../src/lib/services/ratings";
import { importPromotions, ImportAbortError, type ImportEntry } from "../src/lib/services/promotionImport";

const db = new PrismaClient();

async function main() {
  const filePath = path.join(process.cwd(), "data", "new-promotions.json");
  const entries: ImportEntry[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const { created, updated, contentChanged } = await importPromotions(db, entries, (m) => console.warn(m));

  await recomputeRatings();

  console.log(`Gotowe. Utworzono ${created}, zaktualizowano ${updated} promocji (treść realnie zmieniona: ${contentChanged}).`);
  console.log("Pamiętaj: nowe promocje mają status z pliku JSON — sprawdź je w /admin/promocje przed publikacją.");
}

main()
  .catch((e) => {
    console.error(e instanceof ImportAbortError ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
