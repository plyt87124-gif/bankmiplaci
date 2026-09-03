import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/userSession";
import { touchUserActivity } from "@/lib/userActivity";

export async function POST(request: NextRequest, { params }: { params: { commentId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });
  touchUserActivity(user.id);

  const comment = await db.comment.findUnique({ where: { id: params.commentId }, select: { id: true } });
  if (!comment) return NextResponse.json({ error: "Nie znaleziono komentarza." }, { status: 404 });

  const existing = await db.commentLike.findUnique({
    where: { commentId_userId: { commentId: comment.id, userId: user.id } }
  });

  if (existing) {
    await db.commentLike.delete({ where: { id: existing.id } });
  } else {
    await db.commentLike.create({ data: { commentId: comment.id, userId: user.id } });
  }

  const likeCount = await db.commentLike.count({ where: { commentId: comment.id } });
  return NextResponse.json({ likeCount, likedByMe: !existing });
}
