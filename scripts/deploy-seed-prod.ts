/**
 * One-off script: copies real (non-demo) catalog data — banks, promotions,
 * fees, bonus parts, conditions, checklist steps — from the local dev DB
 * into a production DB, and bootstraps the admin account there. Doesn't
 * touch users/comments/analytics — production starts clean on those.
 *
 * Usage: SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... npx tsx scripts/deploy-seed-prod.ts
 */
import { PrismaClient, AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL.");
  process.exit(1);
}

const DEMO_BANK_SLUGS = ["bank-demo", "bank-demo-2", "bank-demo-3"];

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-now";
  const admin = await target.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Administrator",
      role: AdminRole.ADMIN,
      passwordHash: await bcrypt.hash(adminPassword, 12)
    }
  });
  console.log(`✔ Admin: ${admin.email}`);

  const banks = await source.bank.findMany({ where: { slug: { notIn: DEMO_BANK_SLUGS } } });
  for (const bank of banks) {
    await target.bank.upsert({ where: { id: bank.id }, update: bank, create: bank });
  }
  console.log(`✔ Banki: ${banks.length}`);

  const promotions = await source.promotion.findMany({
    where: { bank: { slug: { notIn: DEMO_BANK_SLUGS } } },
    include: { fees: true, bonusParts: true, conditions: true, checklistSteps: true }
  });

  let feeCount = 0, bonusCount = 0, condCount = 0, stepCount = 0;
  for (const p of promotions) {
    const { fees, bonusParts, conditions, checklistSteps, ...promotionData } = p;
    await target.promotion.upsert({ where: { id: p.id }, update: promotionData, create: promotionData });

    if (fees) {
      const { id, promotionId, ...feeData } = fees;
      await target.fees.upsert({ where: { id }, update: { promotionId, ...feeData }, create: { id, promotionId, ...feeData } });
      feeCount++;
    }
    for (const bp of bonusParts) {
      await target.bonusPart.upsert({ where: { id: bp.id }, update: bp, create: bp });
      bonusCount++;
    }
    for (const c of conditions) {
      await target.promotionCondition.upsert({ where: { id: c.id }, update: c, create: c });
      condCount++;
    }
    for (const s of checklistSteps) {
      await target.checklistStep.upsert({ where: { id: s.id }, update: s, create: s });
      stepCount++;
    }
  }
  console.log(`✔ Promocje: ${promotions.length} (fees: ${feeCount}, bonusParts: ${bonusCount}, warunki: ${condCount}, kroki ściągi: ${stepCount})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
