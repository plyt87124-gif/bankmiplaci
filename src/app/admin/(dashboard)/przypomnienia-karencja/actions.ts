"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function markReminderRead(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Nieautoryzowany dostęp.");

  await db.adminNotification.update({ where: { id }, data: { read: true } });
  revalidatePath("/admin/przypomnienia-karencja");
}
