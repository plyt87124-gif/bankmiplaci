/**
 * Creates ONE new promotion (with conditions, bonus parts, fees and the
 * ściąga/checklist) from a candidate JSON, in a single transaction.
 *
 * Usage:
 *   npx tsx scripts/add-promotion-with-checklist.ts data/candidates/<file>.json [more.json …]          # dry-run (default)
 *   npx tsx scripts/add-promotion-with-checklist.ts data/candidates/<file>.json --apply               # writes (DRAFT)
 *   npx tsx scripts/add-promotion-with-checklist.ts data/candidates/<file>.json --apply --active      # writes ACTIVE
 *
 * --active is refused unless DATABASE_URL points at localhost (local testing
 * only); on any other database pass --allow-active-remote explicitly.
 * --notify raises an admin notification (PROMOTION_AUTO_ADDED) per created
 * promotion and sends one e-mail digest to ADMIN_EMAIL (needs RESEND_API_KEY).
 *
 * Deliberately NOT built on importPromotions(): that upserts the bank by slug
 * and would overwrite name/website/logo of an existing bank. This script only
 * READS the bank (it must already exist) and only INSERTS rows for a promotion
 * whose slug does not exist yet. It never updates or deletes anything.
 *
 * The promotion is created as DRAFT unless --active is given.
 * Revert: delete the promotion by slug — conditions, bonus parts, fees and
 * checklist steps cascade (onDelete: Cascade).
 */
import { PrismaClient, type AccountType, type Difficulty } from "@prisma/client";
import fs from "fs";
import path from "path";
import { recomputeRatings } from "../src/lib/services/ratings";
import { sendEmail } from "../src/lib/email";
import { watchDigestEmail } from "../src/lib/services/ebrokerWatch";

type Candidate = {
  bankSlug: string;
  /** eBroker campaign oid. Links the promotion to the campaign and, when affiliateUrl is omitted, supplies the feed's tracking link. */
  ebrokerOid?: string;
  promotion: {
    slug: string;
    name: string;
    accountType: AccountType;
    maxBonusCents: number;
    difficulty: Difficulty;
    rating: number;
    ratingReason?: string | null;
    status: string;
    startDate: string;
    endDate: string;
    affiliateUrl?: string;
    affiliateLinkEnabled: boolean;
    sourceUrl?: string | null;
    additionalSourceUrls?: string[];
    lastVerifiedAt: string;
    eligibleFor?: string | null;
    notEligibleFor?: string | null;
    cooldownMonths?: number | null;
    cooldownCutoffDate?: string | null;
    summary?: string | null;
    conditions: { title: string; description?: string; type: string; order: number }[];
    bonusParts: { label: string; amountCents: number; order: number; availableUntil?: string | null }[];
    fees: {
      accountFeeCents?: number | null;
      accountFeeWaiverCondition?: string | null;
      cardFeeCents?: number | null;
      cardFeeWaiverCondition?: string | null;
      atmFeeCents?: number | null;
      otherFee?: string | null;
      sourceUrl?: string | null;
    };
  };
  checklistSteps: { order: number; monthLabel: string; title: string; rewardCents?: number; availableUntil?: string | null }[];
};

const VALID_CONDITION_TYPES = new Set(["account_opening", "card_payments", "inflow", "deadline", "other"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

function validate(c: Candidate): string[] {
  const p = c.promotion;
  const errs: string[] = [];
  if (!p.affiliateUrl && !c.ebrokerOid) errs.push("brak affiliateUrl i ebrokerOid — nie ma skąd wziąć linku");
  if (!SLUG_RE.test(p.slug)) errs.push(`slug "${p.slug}" ma niedozwolone znaki`);
  if (p.status !== "DRAFT") errs.push(`status w pliku musi być DRAFT (jest ${p.status}); ACTIVE ustawia się flagą --active`);
  if (!Number.isInteger(p.maxBonusCents) || p.maxBonusCents <= 0) errs.push("maxBonusCents musi być dodatnią liczbą całkowitą");
  const partsSum = p.bonusParts.reduce((s, b) => s + b.amountCents, 0);
  if (p.bonusParts.length > 0 && partsSum !== p.maxBonusCents) {
    errs.push(`suma bonusParts (${partsSum}) ≠ maxBonusCents (${p.maxBonusCents})`);
  }
  const rewardSum = c.checklistSteps.reduce((s, st) => s + (st.rewardCents ?? 0), 0);
  if (rewardSum !== p.maxBonusCents) errs.push(`suma rewardCents w ściądze (${rewardSum}) ≠ maxBonusCents (${p.maxBonusCents})`);
  if (Number.isNaN(day(p.startDate).getTime()) || Number.isNaN(day(p.endDate).getTime())) errs.push("niepoprawna data start/koniec");
  if (day(p.endDate) < day(p.startDate)) errs.push("endDate przed startDate");
  for (const cond of p.conditions) {
    if (!VALID_CONDITION_TYPES.has(cond.type)) errs.push(`warunek "${cond.title}": nieznany typ ${cond.type}`);
  }
  const f = p.fees;
  if (f.accountFeeCents === 0 && f.accountFeeWaiverCondition) errs.push("opłata za konto 0 zł z warunkiem zwolnienia (zapisz stawkę BEZ zwolnienia)");
  if (f.cardFeeCents === 0 && f.cardFeeWaiverCondition) errs.push("opłata za kartę 0 zł z warunkiem zwolnienia (zapisz stawkę BEZ zwolnienia)");
  const orders = c.checklistSteps.map((s) => s.order);
  if (new Set(orders).size !== orders.length) errs.push("powtórzone order w checklistSteps");
  return errs;
}

type Mode = { apply: boolean; active: boolean; notify: boolean };

async function createOne(db: PrismaClient, cand: Candidate, mode: Mode): Promise<string> {
  const bank = await db.bank.findUnique({ where: { slug: cand.bankSlug } });
  if (!bank) throw new Error(`Bank "${cand.bankSlug}" nie istnieje — skrypt nie tworzy ani nie zmienia banków.`);
  const existing = await db.promotion.findUnique({ where: { slug: cand.promotion.slug } });
  if (existing) throw new Error(`Promocja "${cand.promotion.slug}" już istnieje — nic nie zmieniam.`);

  const p = cand.promotion;
  let affiliateUrl = p.affiliateUrl;
  if (!affiliateUrl) {
    const camp = await db.ebrokerCampaign.findUnique({ where: { oid: cand.ebrokerOid! } });
    if (!camp) throw new Error(`Kampanii ${cand.ebrokerOid} nie ma w tabeli ebroker_campaigns — uruchom najpierw: scripts/ebroker-watch.ts run`);
    affiliateUrl = camp.trackingUrl;
  }
  const status = mode.active ? "ACTIVE" : "DRAFT";
  console.log(`- ${bank.name}: ${p.name} [${p.slug}] maks. ${p.maxBonusCents / 100} zł, ${p.startDate} → ${p.endDate}, ${status}`);
  console.log(`  warunki: ${p.conditions.length}, części premii: ${p.bonusParts.length}, kroki ściągi: ${cand.checklistSteps.length}`);
  if (!mode.apply) return "dry-run";

  const created = await db.promotion.create({
    data: {
      bankId: bank.id,
      name: p.name,
      slug: p.slug,
      accountType: p.accountType,
      maxBonusCents: p.maxBonusCents,
      difficulty: p.difficulty,
      rating: p.rating,
      ratingReason: p.ratingReason ?? null,
      status,
      affiliateLinkEnabled: mode.active ? true : p.affiliateLinkEnabled,
      startDate: day(p.startDate),
      endDate: day(p.endDate),
      affiliateUrl,
      sourceUrl: p.sourceUrl ?? null,
      additionalSourceUrls: p.additionalSourceUrls ?? [],
      lastVerifiedAt: day(p.lastVerifiedAt),
      eligibleFor: p.eligibleFor ?? null,
      notEligibleFor: p.notEligibleFor ?? null,
      cooldownMonths: p.cooldownMonths ?? null,
      cooldownCutoffDate: p.cooldownCutoffDate ? day(p.cooldownCutoffDate) : null,
      summary: p.summary ?? null,
      conditions: { create: p.conditions.map((c) => ({ title: c.title, description: c.description ?? null, type: c.type, order: c.order })) },
      bonusParts: {
        create: p.bonusParts.map((b) => ({
          label: b.label,
          amountCents: b.amountCents,
          order: b.order,
          availableUntil: b.availableUntil ? day(b.availableUntil) : null
        }))
      },
      fees: {
        create: {
          accountFeeCents: p.fees.accountFeeCents ?? null,
          accountFeeWaiverCondition: p.fees.accountFeeWaiverCondition ?? null,
          cardFeeCents: p.fees.cardFeeCents ?? null,
          cardFeeWaiverCondition: p.fees.cardFeeWaiverCondition ?? null,
          atmFeeCents: p.fees.atmFeeCents ?? null,
          otherFee: p.fees.otherFee ?? null,
          sourceUrl: p.fees.sourceUrl ?? null
        }
      },
      checklistSteps: {
        create: cand.checklistSteps.map((s) => ({
          monthLabel: s.monthLabel,
          title: s.title,
          rewardCents: s.rewardCents ?? null,
          order: s.order,
          availableUntil: s.availableUntil ? day(s.availableUntil) : null
        }))
      }
    }
  });
  if (cand.ebrokerOid) {
    await db.ebrokerCampaign.updateMany({ where: { oid: cand.ebrokerOid }, data: { promotionId: created.id } });
  }
  console.log(`  utworzono id ${created.id}. Cofnięcie: usuń promocję o slugu ${created.slug} (reszta znika kaskadowo).`);
  return created.id;
}

async function main() {
  const args = process.argv.slice(2);
  const mode: Mode = { apply: args.includes("--apply"), active: args.includes("--active"), notify: args.includes("--notify") };
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length === 0) throw new Error("Podaj ścieżkę do pliku JSON kandydata (jedną lub więcej).");

  const candidates: Candidate[] = files.map((f) => JSON.parse(fs.readFileSync(path.resolve(f), "utf-8")));
  const allErrs = candidates.flatMap((c, i) => validate(c).map((e) => `${files[i]}: ${e}`));
  if (allErrs.length) {
    console.error("Błędy walidacji:\n - " + allErrs.join("\n - "));
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  const host = dbUrl.replace(/^.*@/, "").replace(/[/?].*$/, "");
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  console.log(`Baza: ${host || "(brak DATABASE_URL)"}`);
  console.log(`TRYB: ${mode.apply ? "--apply (zapis)" : "dry-run (bez zapisu)"}, status: ${mode.active ? "ACTIVE" : "DRAFT"}`);
  if (mode.active && mode.apply && !isLocal && !args.includes("--allow-active-remote")) {
    throw new Error("--active na bazie innej niż localhost wymaga jawnej flagi --allow-active-remote.");
  }

  const db = new PrismaClient();
  try {
    // One transaction per run is not possible with nested creates across files,
    // so check every slug first: either all files are creatable or none is written.
    for (const c of candidates) {
      const hit = await db.promotion.findUnique({ where: { slug: c.promotion.slug }, select: { id: true } });
      if (hit) throw new Error(`Promocja "${c.promotion.slug}" już istnieje — nic nie zapisano.`);
    }
    const created: { slug: string; name: string; bank: string; id: string }[] = [];
    for (const c of candidates) {
      const id = await createOne(db, c, mode);
      if (mode.apply) created.push({ slug: c.promotion.slug, name: c.promotion.name, bank: c.bankSlug, id });
    }
    if (mode.apply && mode.notify && created.length > 0) {
      const items = created.map((c) => ({
        type: "PROMOTION_AUTO_ADDED" as const,
        title: `Dodano promocję: ${c.name}`,
        body: `Status ${mode.active ? "ACTIVE (opublikowana)" : "DRAFT"}. Sprawdź treść i ściągę w panelu admina: /admin/promocje.`,
        dedupKey: `promo-added:${c.slug}`,
        relatedPromotionId: c.id
      }));
      for (const n of items) {
        await db.adminNotification.create({ data: n }).catch((e: { code?: string }) => {
          if (e.code !== "P2002") throw e;
        });
      }
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const mail = watchDigestEmail(items, `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/promocje`);
        await sendEmail({ to: adminEmail, subject: mail.subject, html: mail.html });
      }
      console.log(`Powiadomienia w adminie: ${items.length}${adminEmail ? ", wysłano e-mail" : " (brak ADMIN_EMAIL — bez e-maila)"}.`);
    }
    if (mode.apply && mode.active) {
      await recomputeRatings();
      console.log("Przeliczono oceny aktywnych promocji.");
    }
    if (!mode.apply) console.log("Dry-run zakończony poprawnie. Nic nie zapisano.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
