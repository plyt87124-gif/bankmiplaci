"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankFormSchema, type BankFormValues } from "@/lib/validation/promotion";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Nieautoryzowany dostęp.");
}

export async function createBank(values: BankFormValues) {
  await requireAdmin();
  const data = bankFormSchema.parse(values);
  await db.bank.create({
    data: {
      name: data.name,
      slug: data.slug,
      logoUrl: data.logoUrl || undefined,
      website: data.website || undefined,
      description: data.description
    }
  });
  revalidatePath("/admin/banki");
}

export async function updateBank(id: string, values: BankFormValues) {
  await requireAdmin();
  const data = bankFormSchema.parse(values);
  await db.bank.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      logoUrl: data.logoUrl || null,
      website: data.website || null,
      description: data.description || null
    }
  });
  revalidatePath("/admin/banki");
  revalidatePath("/promocje");
}

export async function deleteBank(id: string) {
  await requireAdmin();
  await db.bank.delete({ where: { id } });
  revalidatePath("/admin/banki");
}
