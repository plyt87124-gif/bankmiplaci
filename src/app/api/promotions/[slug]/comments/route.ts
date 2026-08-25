import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/userSession";
import { commentSchema } from "@/lib/validation/account";

function authorName(c: { user: { name: string | null; email: string } | null; admin: { name: string } | null }) {
  if (c.admin) return c.admin.name;
  if (c.user) return c.user.name || c.user.email.split("@")[0];
  return "Usunięty użytkownik";
}

function serialize(c: {
  id: string;
  body: string;
  createdAt: Date;
  isPinned: boolean;
  user: { name: string | null; email: string } | null;
  admin: { name: string } | null;
  _count: { likes: number };
}) {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    isPinned: c.isPinned,
    isAdmin: Boolean(c.admin),
    authorName: authorName(c),
    likeCount: c._count.likes
  };
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const promotion = await db.promotion.findUnique({ where: { slug: params.slug }, select: { id: true } });
  if (!promotion) return NextResponse.json({ comments: [] });

  const currentUser = await getCurrentUser();
  const sort = request.nextUrl.searchParams.get("sort") === "top" ? "top" : "newest";

  const topLevel = await db.comment.findMany({
    where: { promotionId: promotion.id, parentId: null },
    include: {
      user: { select: { name: true, email: true } },
      admin: { select: { name: true } },
      _count: { select: { likes: true } },
      likes: currentUser ? { where: { userId: currentUser.id }, select: { id: true } } : false,
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { name: true, email: true } },
          admin: { select: { name: true } },
          _count: { select: { likes: true } },
          likes: currentUser ? { where: { userId: currentUser.id }, select: { id: true } } : false
        }
      }
    },
    orderBy:
      sort === "top" ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }] : [{ createdAt: "desc" }]
  });

  // Pinned comment always first, regardless of chosen sort.
  const pinned = topLevel.filter((c) => c.isPinned);
  const rest = topLevel.filter((c) => !c.isPinned);
  const ordered = [...pinned, ...rest];

  return NextResponse.json({
    comments: ordered.map((c) => ({
      ...serialize(c),
      likedByMe: currentUser ? c.likes.length > 0 : false,
      replies: c.replies.map((r) => ({
        ...serialize(r),
        likedByMe: currentUser ? r.likes.length > 0 : false
      }))
    }))
  });
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany, aby komentować." }, { status: 401 });

  const promotion = await db.promotion.findUnique({ where: { slug: params.slug }, select: { id: true, name: true } });
  if (!promotion) return NextResponse.json({ error: "Nie znaleziono promocji." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowy komentarz." }, { status: 400 });
  }

  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  if (parentId) {
    const parent = await db.comment.findUnique({ where: { id: parentId }, select: { promotionId: true, parentId: true } });
    if (!parent || parent.promotionId !== promotion.id) {
      return NextResponse.json({ error: "Nie znaleziono komentarza, na który odpowiadasz." }, { status: 404 });
    }
    if (parent.parentId) {
      return NextResponse.json({ error: "Można odpowiadać tylko na komentarze główne." }, { status: 400 });
    }
  }

  const comment = await db.comment.create({
    data: { promotionId: promotion.id, userId: user.id, body: parsed.data.body, parentId: parentId ?? undefined }
  });

  // Surface it to the admin as an in-app notification (see /admin —
  // the bell icon shows unread NEW_COMMENT notifications).
  await db.adminNotification.create({
    data: {
      type: "NEW_COMMENT",
      title: parentId ? "Nowa odpowiedź na komentarz" : "Nowy komentarz",
      body: `${user.name || user.email} skomentował/a promocję „${promotion.name}”.`,
      relatedUserId: user.id,
      relatedPromotionId: promotion.id
    }
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      isPinned: false,
      isAdmin: false,
      authorName: user.name || user.email.split("@")[0],
      likeCount: 0,
      likedByMe: false,
      parentId: comment.parentId,
      replies: []
    }
  });
}
