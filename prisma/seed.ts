import { PrismaClient, Difficulty, PromotionStatus, AccountType, AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

/**
 * IMPORTANT: every bank and promotion below is fictional demo data used
 * only to exercise the schema and UI locally. Names are deliberately
 * prefixed "DEMO" so they can never be mistaken for a real bank or
 * offer. Replace this file's contents with real, verified data (or
 * write an import script against your real source) before deploying
 * to production — see README.md.
 */

async function main() {
  // --- Admin user -------------------------------------------------------
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-now";

  const admin = await db.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Administrator",
      role: AdminRole.ADMIN,
      passwordHash: await bcrypt.hash(adminPassword, 12)
    }
  });
  console.log(`✔ Konto administratora: ${admin.email} (zmień hasło po pierwszym logowaniu)`);

  // --- Demo banks ---------------------------------------------------------
  const bankA = await db.bank.upsert({
    where: { slug: "bank-demo" },
    update: {},
    create: {
      name: "BANK DEMO",
      slug: "bank-demo",
      website: "https://example.com",
      description: "Fikcyjny bank używany wyłącznie do celów demonstracyjnych tego projektu."
    }
  });

  const bankB = await db.bank.upsert({
    where: { slug: "bank-demo-2" },
    update: {},
    create: {
      name: "BANK DEMO 2",
      slug: "bank-demo-2",
      website: "https://example.com",
      description: "Fikcyjny bank używany wyłącznie do celów demonstracyjnych tego projektu."
    }
  });

  const bankC = await db.bank.upsert({
    where: { slug: "bank-demo-3" },
    update: {},
    create: {
      name: "BANK DEMO 3",
      slug: "bank-demo-3",
      website: "https://example.com",
      description: "Fikcyjny bank używany wyłącznie do celów demonstracyjnych tego projektu."
    }
  });

  // --- Demo promotions ----------------------------------------------------
  const in60days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const in90days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const in10days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const past30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const today = new Date();

  await upsertPromotion({
    slug: "bank-demo-700-zl",
    bankId: bankA.id,
    name: "Przykładowa promocja — Konto Otwarte",
    accountType: AccountType.PERSONAL,
    maxBonusCents: 70000,
    difficulty: Difficulty.EASY,
    rating: 9.4,
    ratingReason: "Wysoka premia i niewiele wymaganych czynności (dane demonstracyjne).",
    status: PromotionStatus.ACTIVE,
    startDate: today,
    endDate: in60days,
    affiliateUrl: "https://example.com/affiliate/demo-1",
    sourceUrl: "https://example.com/regulamin-demo-1",
    lastVerifiedAt: today,
    eligibleFor: "Nowi klienci banku, którzy nie posiadali konta w ciągu ostatnich 12 miesięcy (przykład).",
    notEligibleFor: "Obecni i byli klienci banku posiadający już konto osobiste (przykład).",
    summary: "Przykładowa promocja demonstracyjna — do 700 zł premii za otwarcie konta i płatności kartą.",
    conditions: [
      { title: "Otwórz konto przez wskazany kanał", type: "account_opening", order: 0, description: "Wniosek należy złożyć online (przykład)." },
      { title: "Wykonaj 5 płatności kartą w miesiącu", type: "card_payments", order: 1 },
      { title: "Zapewnij wpływ min. 1000 zł", type: "inflow", order: 2 }
    ],
    bonusParts: [
      { label: "Premia podstawowa", amountCents: 20000, order: 0 },
      { label: "Premia za płatności kartą", amountCents: 20000, order: 1 },
      { label: "Premia za wpływ", amountCents: 30000, order: 2 }
    ],
    fees: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0, otherFee: "Konto bezpłatne bez dodatkowych warunków (przykład)." }
  });

  await upsertPromotion({
    slug: "bank-demo-2-900-zl",
    bankId: bankB.id,
    name: "Przykładowa promocja — Konto Premia+",
    accountType: AccountType.PERSONAL,
    maxBonusCents: 90000,
    difficulty: Difficulty.HARD,
    rating: 8.1,
    ratingReason: "Bardzo wysoka premia, ale wymaga znacznego wysiłku (dane demonstracyjne).",
    status: PromotionStatus.ACTIVE,
    startDate: today,
    endDate: in90days,
    affiliateUrl: "https://example.com/affiliate/demo-2",
    sourceUrl: "https://example.com/regulamin-demo-2",
    lastVerifiedAt: today,
    eligibleFor: "Nowi klienci banku (przykład).",
    notEligibleFor: null,
    summary: "Przykładowa promocja demonstracyjna — do 900 zł premii, wymaga wysokiego wpływu miesięcznego.",
    conditions: [
      { title: "Otwórz konto online", type: "account_opening", order: 0 },
      { title: "Zapewnij wpływ min. 5000 zł miesięcznie przez 3 miesiące", type: "inflow", order: 1 },
      { title: "Aktywuj i używaj aplikacji mobilnej", type: "other", order: 2 }
    ],
    bonusParts: [],
    fees: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 500, otherFee: "0 zł za prowadzenie konta przy spełnieniu warunku wpływu (przykład)." }
  });

  await upsertPromotion({
    slug: "bank-demo-3-500-zl",
    bankId: bankC.id,
    name: "Przykładowa promocja — Konto Start",
    accountType: AccountType.YOUNG,
    maxBonusCents: 50000,
    difficulty: Difficulty.VERY_EASY,
    rating: 9.0,
    ratingReason: "Bardzo niski próg wejścia — wystarczy otworzyć konto (dane demonstracyjne).",
    status: PromotionStatus.ACTIVE,
    startDate: today,
    endDate: in10days,
    affiliateUrl: "https://example.com/affiliate/demo-3",
    sourceUrl: "https://example.com/regulamin-demo-3",
    lastVerifiedAt: today,
    eligibleFor: "Osoby w wieku 18–26 lat (przykład).",
    notEligibleFor: "Osoby posiadające już konto w banku (przykład).",
    summary: "Przykładowa promocja demonstracyjna — 500 zł premii bez dodatkowych wymagań poza otwarciem konta.",
    conditions: [{ title: "Otwórz konto online i potwierdź tożsamość", type: "account_opening", order: 0 }],
    bonusParts: [],
    fees: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 }
  });

  // A deliberately expired demo promotion, to exercise the "expired" states.
  await upsertPromotion({
    slug: "bank-demo-wygasla",
    bankId: bankA.id,
    name: "Przykładowa promocja archiwalna",
    accountType: AccountType.PERSONAL,
    maxBonusCents: 40000,
    difficulty: Difficulty.MEDIUM,
    rating: 7.5,
    ratingReason: null,
    status: PromotionStatus.EXPIRED,
    startDate: past30days,
    endDate: past30days,
    affiliateUrl: "https://example.com/affiliate/demo-4",
    sourceUrl: null,
    lastVerifiedAt: past30days,
    eligibleFor: null,
    notEligibleFor: null,
    summary: "Przykładowa, już wygasła promocja demonstracyjna — pokazuje stan „wygasła” w interfejsie.",
    conditions: [],
    bonusParts: [],
    fees: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 }
  });

  console.log("✔ Dane demonstracyjne zostały wczytane (wyraźnie oznaczone jako DEMO).");
}

interface SeedPromotion {
  slug: string;
  bankId: string;
  name: string;
  accountType: AccountType;
  maxBonusCents: number;
  difficulty: Difficulty;
  rating: number;
  ratingReason: string | null;
  status: PromotionStatus;
  startDate: Date;
  endDate: Date;
  affiliateUrl: string;
  sourceUrl: string | null;
  lastVerifiedAt: Date;
  eligibleFor: string | null;
  notEligibleFor: string | null;
  summary: string;
  conditions: { title: string; description?: string; type: string; order: number }[];
  bonusParts: { label: string; amountCents: number; order: number }[];
  fees: { accountFeeCents: number; cardFeeCents: number; atmFeeCents: number; otherFee?: string };
}

async function upsertPromotion(p: SeedPromotion) {
  const existing = await db.promotion.findUnique({ where: { slug: p.slug } });
  if (existing) {
    await db.promotionCondition.deleteMany({ where: { promotionId: existing.id } });
    await db.bonusPart.deleteMany({ where: { promotionId: existing.id } });
  }

  await db.promotion.upsert({
    where: { slug: p.slug },
    update: {
      name: p.name,
      accountType: p.accountType,
      maxBonusCents: p.maxBonusCents,
      difficulty: p.difficulty,
      rating: p.rating,
      ratingReason: p.ratingReason,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      affiliateUrl: p.affiliateUrl,
      sourceUrl: p.sourceUrl,
      lastVerifiedAt: p.lastVerifiedAt,
      eligibleFor: p.eligibleFor,
      notEligibleFor: p.notEligibleFor,
      summary: p.summary,
      conditions: { create: p.conditions },
      bonusParts: { create: p.bonusParts },
      fees: { upsert: { create: p.fees, update: p.fees } }
    },
    create: {
      slug: p.slug,
      bankId: p.bankId,
      name: p.name,
      accountType: p.accountType,
      maxBonusCents: p.maxBonusCents,
      difficulty: p.difficulty,
      rating: p.rating,
      ratingReason: p.ratingReason,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      affiliateUrl: p.affiliateUrl,
      sourceUrl: p.sourceUrl,
      lastVerifiedAt: p.lastVerifiedAt,
      eligibleFor: p.eligibleFor,
      notEligibleFor: p.notEligibleFor,
      summary: p.summary,
      conditions: { create: p.conditions },
      bonusParts: { create: p.bonusParts },
      fees: { create: p.fees }
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
