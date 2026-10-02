import { z } from "zod";

export const conditionSchema = z.object({
  title: z.string().min(3, "Podaj tytuł warunku"),
  description: z.string().optional(),
  type: z.enum(["account_opening", "card_payments", "inflow", "deadline", "other"]),
  order: z.number().int().min(0).default(0)
});

export const bonusPartSchema = z.object({
  label: z.string().min(2),
  amountCents: z.number().int().positive("Kwota musi być dodatnia"),
  order: z.number().int().min(0).default(0),
  // Last day a new participant can join the sub-offer this reward belongs
  // to, when it differs from the promotion's own endDate. Blank = same as
  // the promotion. Must round-trip through the form: updatePromotion
  // recreates every bonus part from the submitted values, so a form that
  // dropped this field would silently erase it on the next save.
  availableUntil: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.date().optional())
});

// A fee amount left blank in the form (-> NaN from valueAsNumber, or ""
// if ever submitted as a plain string) means "not verified yet", NOT
// "confirmed 0 zł" — so it must become `undefined`/null here, never
// silently default to 0. See prisma/schema.prisma Fees for the same
// null-means-unverified convention at the data layer.
const optionalFeeCents = z.preprocess(
  (v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.number().int().min(0).optional()
);

export const feesSchema = z.object({
  accountFeeCents: optionalFeeCents,
  // Free text describing the condition under which accountFeeCents is
  // waived to 0 (e.g. "przy wpływie min. 500 zł/mies."). Leave unset for
  // a plain, unconditional fee.
  accountFeeWaiverCondition: z.string().optional(),
  cardFeeCents: optionalFeeCents,
  cardFeeWaiverCondition: z.string().optional(),
  atmFeeCents: optionalFeeCents,
  otherFee: z.string().optional()
});

export const promotionFormSchema = z
  .object({
    bankId: z.string().min(1, "Wybierz bank"),
    name: z.string().min(3, "Nazwa promocji jest wymagana"),
    slug: z
      .string()
      .min(3)
      .regex(/^[a-z0-9-]+$/, "Slug może zawierać tylko małe litery, cyfry i myślniki"),
    accountType: z.enum(["PERSONAL", "SAVINGS", "YOUNG", "BUSINESS", "JOINT"]),
    maxBonusCents: z.number().int().positive("Podaj maksymalną premię w groszach"),
    difficulty: z.enum(["VERY_EASY", "EASY", "MEDIUM", "HARD"]),
    // Ocena is computed automatically (see src/lib/services/ratings.ts) —
    // ratingOverride is the only admin-writable escape hatch, left unset
    // ("let the algorithm decide") unless an admin explicitly pins it.
    ratingOverride: z.preprocess(
      (v) => (v === "" || v === null || Number.isNaN(v) ? undefined : v),
      z.number().min(0).max(10).optional()
    ),
    ratingReason: z.string().max(280).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "ARCHIVED"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    affiliateUrl: z.string().url("Podaj poprawny adres URL"),
    sourceUrl: z.string().url().optional().or(z.literal("")),
    lastVerifiedAt: z.coerce.date(),
    eligibleFor: z.string().optional(),
    notEligibleFor: z.string().optional(),
    cooldownMonths: z.preprocess(
      (v) => (v === "" || v === null || Number.isNaN(v) ? undefined : v),
      z.number().int().min(0).max(120).optional()
    ),
    cooldownCutoffDate: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.date().optional()),
    summary: z.string().max(240).optional(),
    description: z.string().optional(),
    conditions: z.array(conditionSchema).default([]),
    bonusParts: z.array(bonusPartSchema).default([]),
    fees: feesSchema
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "Data zakończenia musi być późniejsza niż data rozpoczęcia",
    path: ["endDate"]
  });

export type PromotionFormValues = z.infer<typeof promotionFormSchema>;

export const bankFormSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().optional()
});

export type BankFormValues = z.infer<typeof bankFormSchema>;
