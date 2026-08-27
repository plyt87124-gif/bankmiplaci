"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { passwordResetEmailHtml } from "@/lib/emailTemplates";
import { createPasswordResetToken, passwordResetUrl } from "@/lib/passwordReset";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Nieautoryzowany dostęp.");

  const admin = await db.adminUser.findUnique({ where: { email: session.user.email } });
  if (!admin) throw new Error("Nieautoryzowany dostęp.");
  return admin;
}

export async function sendPasswordResetLink(userId: string) {
  await requireAdmin();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Nie znaleziono użytkownika.");

  const rawToken = await createPasswordResetToken(user.id);
  await sendEmail({
    to: user.email,
    subject: "Reset hasła — Bankmiplaci",
    html: passwordResetEmailHtml(passwordResetUrl(rawToken))
  });

  revalidatePath(`/admin/uzytkownicy/${userId}`);
}

export async function deleteUserAccount(userId: string) {
  await requireAdmin();

  await db.user.delete({ where: { id: userId } });

  revalidatePath("/admin/uzytkownicy");
  redirect("/admin/uzytkownicy");
}
