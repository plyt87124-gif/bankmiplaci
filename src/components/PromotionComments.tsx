"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Heart, Pin } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useAuthModal } from "@/components/AuthModalProvider";

interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  isPinned: boolean;
  isAdmin: boolean;
  authorName: string;
  likeCount: number;
  likedByMe: boolean;
  replies?: CommentItem[];
}

type SortMode = "newest" | "top";

export function PromotionComments({
  promotionSlug,
  currentUser
}: {
  promotionSlug: string;
  currentUser: { email: string; name: string | null } | null;
}) {
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [sort, setSort] = useState<SortMode>("newest");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const { openAuth } = useAuthModal();

  useEffect(() => {
    setComments(null);
    fetch(`/api/promotions/${promotionSlug}/comments?sort=${sort}`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }, [promotionSlug, sort]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/promotions/${promotionSlug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(data?.error ?? "Nie udało się dodać komentarza.");
      return;
    }

    setComments((prev) => [data.comment, ...(prev ?? [])]);
    setBody("");
  }

  async function onReply(parentId: string) {
    if (!replyBody.trim()) return;
    const res = await fetch(`/api/promotions/${promotionSlug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody, parentId })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return;

    setComments((prev) =>
      (prev ?? []).map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), data.comment] } : c))
    );
    setReplyBody("");
    setReplyTo(null);
  }

  async function onLike(commentId: string, isReplyOf?: string) {
    if (!currentUser) return;
    const res = await fetch(`/api/promotions/${promotionSlug}/comments/${commentId}/like`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return;

    setComments((prev) =>
      (prev ?? []).map((c) => {
        if (isReplyOf) {
          if (c.id !== isReplyOf) return c;
          return { ...c, replies: c.replies?.map((r) => (r.id === commentId ? { ...r, likeCount: data.likeCount, likedByMe: data.likedByMe } : r)) };
        }
        if (c.id !== commentId) return c;
        return { ...c, likeCount: data.likeCount, likedByMe: data.likedByMe };
      })
    );
  }

  const total = (comments ?? []).reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <MessageCircle className="h-5 w-5 text-ink-500" /> Komentarze {comments ? `(${total})` : ""}
        </h2>
        {comments && comments.length > 0 && (
          <div className="flex gap-1 rounded-full border border-ink-100 p-1 text-xs">
            <button
              onClick={() => setSort("newest")}
              className={`rounded-full px-3 py-1 font-medium ${sort === "newest" ? "bg-ink-solid text-white" : "text-ink-700"}`}
            >
              Najnowsze
            </button>
            <button
              onClick={() => setSort("top")}
              className={`rounded-full px-3 py-1 font-medium ${sort === "top" ? "bg-ink-solid text-white" : "text-ink-700"}`}
            >
              Najlepiej oceniane
            </button>
          </div>
        )}
      </div>

      {currentUser ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Zapytaj o szczegóły promocji albo podziel się doświadczeniem..."
            className="w-full rounded-xl2 border border-ink-100 bg-surface px-3 py-2.5 text-sm outline-none focus:border-teal-500"
          />
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button
            disabled={submitting || !body.trim()}
            className="rounded-full bg-ink-solid px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? "Wysyłanie..." : "Dodaj komentarz"}
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-xl2 border border-dashed border-ink-100 bg-surface p-4 text-sm text-ink-500">
          <button onClick={() => openAuth({ mode: "login" })} className="font-medium text-teal-700 underline">
            Zaloguj się
          </button>{" "}
          albo{" "}
          <button onClick={() => openAuth({ mode: "register" })} className="font-medium text-teal-700 underline">
            załóż darmowe konto
          </button>
          , żeby skomentować lub dopytać o szczegóły tej promocji.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {comments === null && <p className="text-sm text-ink-500">Wczytywanie komentarzy...</p>}
        {comments?.length === 0 && <p className="text-sm text-ink-500">Nikt jeszcze nie skomentował tej promocji.</p>}
        {comments?.map((c) => (
          <div key={c.id}>
            <CommentCard
              comment={c}
              canReply
              isReplying={replyTo === c.id}
              onToggleReply={() => setReplyTo(replyTo === c.id ? null : c.id)}
              onLike={() => onLike(c.id)}
              canLike={Boolean(currentUser)}
            />
            {replyTo === c.id && currentUser && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onReply(c.id);
                }}
                className="ml-8 mt-2 flex gap-2"
              >
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={2}
                  placeholder={`Odpowiedz ${c.authorName}...`}
                  className="flex-1 rounded-xl2 border border-ink-100 bg-surface px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <button
                  disabled={!replyBody.trim()}
                  className="self-start rounded-full bg-ink-solid px-4 py-2 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  Wyślij
                </button>
              </form>
            )}
            {c.replies && c.replies.length > 0 && (
              <div className="ml-8 mt-2 space-y-2 border-l-2 border-ink-100 pl-4">
                {c.replies.map((r) => (
                  <CommentCard key={r.id} comment={r} canReply={false} onLike={() => onLike(r.id, c.id)} canLike={Boolean(currentUser)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CommentCard({
  comment,
  canReply,
  isReplying,
  onToggleReply,
  onLike,
  canLike
}: {
  comment: CommentItem;
  canReply: boolean;
  isReplying?: boolean;
  onToggleReply?: () => void;
  onLike: () => void;
  canLike: boolean;
}) {
  return (
    <div
      className={`rounded-xl2 border p-4 ${
        comment.isPinned
          ? "border-gold-600 bg-gold-100/40"
          : comment.isAdmin
            ? "border-teal-500 bg-teal-100/40"
            : "border-ink-100 bg-surface"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`flex items-center gap-1.5 text-sm font-medium ${comment.isAdmin ? "text-teal-700" : "text-ink-900"}`}>
          {comment.isPinned && <Pin className="h-3.5 w-3.5 text-gold-600" />}
          {comment.authorName}
          {comment.isAdmin && (
            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Admin
            </span>
          )}
        </p>
        <p className="text-xs text-ink-300">{formatDate(comment.createdAt)}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{comment.body}</p>
      <div className="mt-3 flex items-center gap-4 text-xs">
        <button
          onClick={onLike}
          disabled={!canLike}
          className={`flex items-center gap-1 font-medium ${comment.likedByMe ? "text-coral-600" : "text-ink-500"} disabled:opacity-50`}
        >
          <Heart className={`h-3.5 w-3.5 ${comment.likedByMe ? "fill-coral-600" : ""}`} /> {comment.likeCount}
        </button>
        {canReply && (
          <button onClick={onToggleReply} className="font-medium text-ink-500 hover:text-ink-900">
            {isReplying ? "Anuluj" : "Odpowiedz"}
          </button>
        )}
      </div>
    </div>
  );
}
