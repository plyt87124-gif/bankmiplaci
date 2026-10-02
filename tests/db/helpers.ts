/**
 * Shared helpers for the database-backed tests (npm run test:db). They run
 * against a real Postgres that already has the migrations applied - the CI
 * service container, or the local dev database - and refuse to run against
 * anything but localhost. Every row they create has the slug prefix `dbt-`
 * and is deleted afterwards.
 */
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { promotionFormSchema, type PromotionFormValues } from "../../src/lib/validation/promotion";
import { promotionToFormDefaults } from "../../src/lib/promotionForm";

if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL="?([^"]+)"?$/);
    if (m) process.env.DATABASE_URL = m[1];
  }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("tests/db refuse to run: DATABASE_URL is not a local/test database.");
}

export const client = new PrismaClient();
export const PREFIX = "dbt-";
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

export async function cleanup() {
  const users = await client.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  await client.adminNotification.deleteMany({ where: { relatedUserId: { in: userIds } } });
  await client.user.deleteMany({ where: { id: { in: userIds } } }); // cascades history, tracking, progress
  await client.promotion.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await client.bank.deleteMany({ where: { slug: { startsWith: PREFIX } } });
}

/** A throw-away site user (never a real e-mail address; nothing here sends mail). */
export function makeUser(tag: string) {
  return client.user.create({
    data: { email: `${PREFIX}${tag}@example.test`, username: `${PREFIX.replace("-", "_")}${tag}`.slice(0, 20), passwordHash: "x", name: `Test ${tag}` }
  });
}

export const INCLUDE = { conditions: true, bonusParts: { orderBy: { order: "asc" as const } }, fees: true };

export async function makePromotion(slug: string, extra: Record<string, unknown> = {}, bankSlug = `${PREFIX}bank`) {
  const bank = await client.bank.upsert({ where: { slug: bankSlug }, update: {}, create: { name: "DBT Bank", slug: bankSlug } });
  return client.promotion.create({
    data: {
      bankId: bank.id,
      name: `Promocja ${slug}`,
      slug: `${PREFIX}${slug}`,
      accountType: "PERSONAL",
      maxBonusCents: 150000,
      difficulty: "EASY",
      rating: 9,
      status: "ACTIVE",
      startDate: day("2026-09-01"),
      endDate: day("2026-11-30"),
      affiliateUrl: "https://example.com/partner",
      lastVerifiedAt: day("2026-10-02"),
      summary: "Opis",
      ...extra
    },
    include: INCLUDE
  });
}

export const reload = (id: string) => client.promotion.findUniqueOrThrow({ where: { id }, include: INCLUDE });

/**
 * What the admin form submits when "Zapisz zmiany" is clicked: the edit page's
 * defaults (promotionToFormDefaults), with blank number inputs becoming NaN
 * (react-hook-form valueAsNumber) - then through the real zod schema, exactly
 * like the server action does. `fees` overrides replace what the "user typed".
 */
export function submit(
  row: Awaited<ReturnType<typeof reload>>,
  edits: Partial<Omit<PromotionFormValues, "cooldownCutoffDate" | "sourceUrl" | "cooldownMonths">> & {
    fees?: Record<string, number | string | undefined>;
    /** What the browser inputs hold: text "" / NaN (valueAsNumber) / date "" when blank. */
    sourceUrl?: string;
    cooldownMonths?: number;
    cooldownCutoffDate?: string;
  } = {}
): PromotionFormValues {
  // A blank text/number/date input submits "" / NaN / "" - never an absent key.
  const defaults: Record<string, unknown> = { ...promotionToFormDefaults(row) };
  if (defaults.sourceUrl === undefined) defaults.sourceUrl = "";
  if (defaults.cooldownMonths === undefined) defaults.cooldownMonths = NaN;
  if (defaults.cooldownCutoffDate === undefined) defaults.cooldownCutoffDate = "";
  const formFees = (promotionToFormDefaults(row).fees ?? {}) as Record<string, unknown>;
  const amounts = ["accountFeeCents", "cardFeeCents", "atmFeeCents"] as const;
  const fees: Record<string, unknown> = { ...formFees };
  for (const k of amounts) if (fees[k] === undefined || fees[k] === null) fees[k] = NaN;
  Object.assign(fees, edits.fees ?? {});
  const { fees: _ignored, ...rest } = edits;
  void _ignored;
  return promotionFormSchema.parse({ ...defaults, ...rest, fees });
}
