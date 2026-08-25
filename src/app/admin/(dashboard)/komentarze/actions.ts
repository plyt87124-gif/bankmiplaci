"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Nieautoryzowany dostęp.");

  const admin = await db.adminUser.findUnique({ where: { email: session.user.email } });
  if (!admin) throw new Error("Nieautoryzowany dostęp.");
  return admin;
}

export async function deleteComment(id: string) {
  await requireAdmin();

  await db.comment.delete({ where: { id } });
  revalidatePath("/admin/komentarze");
}

export async function pinComment(id: string, promotionId: string) {
  await requireAdmin();

  await db.$transaction([
    db.comment.updateMany({ where: { promotionId, isPinned: true }, data: { isPinned: false } }),
    db.comment.update({ where: { id }, data: { isPinned: true } })
  ]);
  revalidatePath("/admin/komentarze");
}

export async function unpinComment(id: string) {
  await requireAdmin();

  await db.comment.update({ where: { id }, data: { isPinned: false } });
  revalidatePath("/admin/komentarze");
}

export async function postAdminReply(formData: FormData) {
  const admin = await requireAdmin();

  const parentId = String(formData.get("parentId"));
  const promotionId = String(formData.get("promotionId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await db.comment.create({
    data: { promotionId, parentId, adminId: admin.id, body }
  });
  revalidatePath("/admin/komentarze");
}
