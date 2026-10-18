"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/userSession";
import { db } from "@/lib/db";
import { warsawTodayAsUtcMidnight } from "@/lib/promotionAvailability";
import type { AccountType } from "@prisma/client";

export async function upsertBankHistory(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Musisz być zalogowany.");

  const bankId = String(formData.get("bankId"));
  const accountType = String(formData.get("accountType")) as AccountType;
  const untilRaw = formData.get("wasClientUntil");
  const untilValue = untilRaw ? String(untilRaw).trim() : "";

  // "Jestem obecnie klientem": no closure date yet. Stored as a start date (today) without an end date.
  if (formData.get("currentClient") === "on") {
    const since = warsawTodayAsUtcMidnight();
    await db.userBankHistory.upsert({
      where: { userId_bankId_accountType: { userId: user.id, bankId, accountType } },
      update: { wasClientFrom: since, wasClientUntil: null, eligibilityNotifiedAt: null },
      create: { userId: user.id, bankId, accountType, wasClientFrom: since }
    });
    revalidatePath("/konto");
    return;
  }

  if (!untilValue) return;

  await db.userBankHistory.upsert({
    where: { userId_bankId_accountType: { userId: user.id, bankId, accountType } },
    update: {
      wasClientUntil: new Date(untilValue),
      // Editing the date re-opens the possibility of a future
      // eligibility notification for the new date.
      eligibilityNotifiedAt: null
    },
    create: { userId: user.id, bankId, accountType, wasClientUntil: new Date(untilValue) }
  });

  revalidatePath("/konto");
}

export async function deleteBankHistoryEntry(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Musisz być zalogowany.");

  // Scope the delete to the current user so nobody can delete someone
  // else's entry by guessing an id.
  await db.userBankHistory.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/konto");
}
