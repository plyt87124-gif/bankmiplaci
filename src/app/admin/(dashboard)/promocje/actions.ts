"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { promotionFormSchema, type PromotionFormValues } from "@/lib/validation/promotion";
import { PromotionStatus } from "@prisma/client";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Nieautoryzowany dostęp.");
  return session;
}

export async function createPromotion(values: PromotionFormValues) {
  await requireAdmin();
  const data = promotionFormSchema.parse(values);

  const promotion = await db.promotion.create({
    data: {
      bankId: data.bankId,
      name: data.name,
      slug: data.slug,
      accountType: data.accountType,
      maxBonusCents: data.maxBonusCents,
      difficulty: data.difficulty,
      rating: data.rating,
      ratingReason: data.ratingReason,
      status: data.status,
      startDate: data.startDate,
      endDate: data.endDate,
      affiliateUrl: data.affiliateUrl,
      sourceUrl: data.sourceUrl || undefined,
      lastVerifiedAt: data.lastVerifiedAt,
      eligibleFor: data.eligibleFor,
      notEligibleFor: data.notEligibleFor,
      cooldownMonths: data.cooldownMonths,
      cooldownCutoffDate: data.cooldownCutoffDate,
      summary: data.summary,
      description: data.description,
      conditions: { create: data.conditions },
      bonusParts: { create: data.bonusParts },
      fees: { create: data.fees }
    }
  });

  revalidatePath("/promocje");
  revalidatePath("/admin/promocje");
  redirect(`/admin/promocje/${promotion.id}`);
}

export async function updatePromotion(id: string, values: PromotionFormValues) {
  await requireAdmin();
  const data = promotionFormSchema.parse(values);

  await db.$transaction([
    db.promotionCondition.deleteMany({ where: { promotionId: id } }),
    db.bonusPart.deleteMany({ where: { promotionId: id } }),
    db.promotion.update({
      where: { id },
      data: {
        bankId: data.bankId,
        name: data.name,
        slug: data.slug,
        accountType: data.accountType,
        maxBonusCents: data.maxBonusCents,
        difficulty: data.difficulty,
        rating: data.rating,
        ratingReason: data.ratingReason,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        affiliateUrl: data.affiliateUrl,
        sourceUrl: data.sourceUrl || undefined,
        lastVerifiedAt: data.lastVerifiedAt,
        eligibleFor: data.eligibleFor,
        notEligibleFor: data.notEligibleFor,
        cooldownMonths: data.cooldownMonths,
        cooldownCutoffDate: data.cooldownCutoffDate,
        summary: data.summary,
        description: data.description,
        conditions: { create: data.conditions },
        bonusParts: { create: data.bonusParts },
        fees: { upsert: { create: data.fees, update: data.fees } }
      }
    })
  ]);

  revalidatePath("/promocje");
  revalidatePath(`/promocje/${data.slug}`);
  revalidatePath("/admin/promocje");
}

export async function setPromotionStatus(id: string, status: PromotionStatus) {
  await requireAdmin();
  await db.promotion.update({ where: { id }, data: { status } });
  revalidatePath("/promocje");
  revalidatePath("/admin/promocje");
}

export async function deletePromotion(id: string) {
  await requireAdmin();
  await db.promotion.delete({ where: { id } });
  revalidatePath("/promocje");
  revalidatePath("/admin/promocje");
}
