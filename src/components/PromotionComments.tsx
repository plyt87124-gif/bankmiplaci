"use client";

import { useEffect, useId, useState } from "react";
import { Heart, MessageCircle, Pin, ShieldCheck } from "lucide-react";
import { formatDate, pluralizePl } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuthModal } from "@/components/AuthModalProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Input";
import { TrustNote } from "@/components/trust/TrustNote";

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

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Najnowsze" },
  { value: "top", label: "Najlepiej oceniane" }
];

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
  const [replyError, setReplyError] = useState<string | null>(null);
  const { openAuth } = useAuthModal();
  const baseId = useId();
  const formId = `${baseId}-body`;
  const errorId = `${baseId}-error`;

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
    setReplyError(null);
    const res = await fetch(`/api/promotions/${promotionSlug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody, parentId })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setReplyError(data?.error ?? "Nie udało się dodać odpowiedzi.");
      return;
    }

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
    <section className="mt-12" aria-labelledby={`${baseId}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${baseId}-heading`} className="flex items-center gap-2">
          <MessageCircle size={24} aria-hidden="true" className="shrink-0 text-ink-500" />
          <span>Komentarze{comments ? ` (${total})` : ""}</span>
        </h2>
        {comments && comments.length > 0 && (
          <div role="group" aria-label="Sortowanie komentarzy" className="inline-flex gap-1 rounded-full border border-line-strong p-1">
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSort(option.value)}
                  className={cn(
                    "min-h-9 rounded-full px-4 text-small font-semibold transition-colors duration-150 ease-out",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                    active ? "bg-action text-on-action" : "text-ink-700 hover:bg-ink-100"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {currentUser ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <Label htmlFor={formId} srOnly>
              Twój komentarz
            </Label>
            <Textarea
              id={formId}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Zapytaj o szczegóły promocji albo podziel się doświadczeniem..."
              invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
            <FormMessage id={errorId}>{error}</FormMessage>
          </div>
          <Button type="submit" loading={submitting} disabled={!body.trim()}>
            {submitting ? "Wysyłanie..." : "Dodaj komentarz"}
          </Button>
        </form>
      ) : (
        <div className="mt-4 rounded-card border border-dashed border-line-strong bg-surface p-4 sm:p-5">
          <p className="text-ui text-ink-700">
            Komentować mogą zalogowani użytkownicy. Zaloguj się albo załóż darmowe konto, żeby skomentować lub
            dopytać o szczegóły tej promocji.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => openAuth({ mode: "login" })}>
              Zaloguj się
            </Button>
            <Button variant="ghost" onClick={() => openAuth({ mode: "register" })}>
              Załóż darmowe konto
            </Button>
          </div>
        </div>
      )}

      <TrustNote kind="comments" className="mt-3" />

      <div className="mt-6" aria-busy={comments === null}>
        {comments === null && (
          <p role="status" className="text-ui text-ink-500">
            Wczytywanie komentarzy...
          </p>
        )}
        {comments?.length === 0 && <p className="text-ui text-ink-700">Nikt jeszcze nie skomentował tej promocji.</p>}
        {comments && comments.length > 0 && (
          <ul role="list" className="space-y-4">
            {comments.map((c) => (
              <li key={c.id}>
                <CommentCard
                  comment={c}
                  canReply
                  isReplying={replyTo === c.id}
                  onToggleReply={() => {
                    setReplyError(null);
                    setReplyTo(replyTo === c.id ? null : c.id);
                  }}
                  onLike={() => onLike(c.id)}
                  canLike={Boolean(currentUser)}
                />
                {replyTo === c.id && currentUser && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onReply(c.id);
                    }}
                    className="ml-4 mt-3 sm:ml-8"
                  >
                    <Label htmlFor={`${baseId}-reply-${c.id}`} srOnly>
                      {`Odpowiedź dla: ${c.authorName}`}
                    </Label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <Textarea
                        id={`${baseId}-reply-${c.id}`}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        rows={2}
                        placeholder={`Odpowiedz ${c.authorName}...`}
                        invalid={Boolean(replyError)}
                        aria-describedby={replyError ? `${baseId}-reply-error` : undefined}
                        className="min-h-[5rem] flex-1"
                        autoFocus
                      />
                      <Button type="submit" disabled={!replyBody.trim()} className="self-start">
                        Wyślij
                      </Button>
                    </div>
                    <FormMessage id={`${baseId}-reply-error`}>{replyError}</FormMessage>
                  </form>
                )}
                {c.replies && c.replies.length > 0 && (
                  <ul role="list" className="ml-4 mt-3 space-y-3 border-l-2 border-line-strong pl-4 sm:ml-8">
                    {c.replies.map((r) => (
                      <li key={r.id}>
                        <CommentCard comment={r} canReply={false} onLike={() => onLike(r.id, c.id)} canLike={Boolean(currentUser)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
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
  const likesText = `${comment.likeCount} ${pluralizePl(comment.likeCount, "polubienie", "polubienia", "polubień")}`;
  return (
    <article
      className={cn(
        "rounded-card border p-4",
        comment.isPinned
          ? "border-gold-500 bg-gold-100/40"
          : comment.isAdmin
            ? "border-teal-600 bg-teal-100/40"
            : "border-line bg-surface"
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex flex-wrap items-center gap-2 text-ui font-semibold text-ink-900">
          <span className="break-words">{comment.authorName}</span>
          {comment.isAdmin && (
            <Badge variant="verified" icon={ShieldCheck}>
              Admin
            </Badge>
          )}
          {comment.isPinned && (
            <Badge variant="neutral" icon={Pin}>
              Przypięty
            </Badge>
          )}
        </p>
        <time dateTime={comment.createdAt} className="text-caption text-ink-500">
          {formatDate(comment.createdAt)}
        </time>
      </header>
      <p className="mt-2 whitespace-pre-wrap break-words text-ui text-ink-700">{comment.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {canLike ? (
          <button
            type="button"
            onClick={onLike}
            aria-pressed={comment.likedByMe}
            aria-label={`Polub komentarz (${likesText})`}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-field px-3 text-small font-semibold hover:bg-ink-100",
              comment.likedByMe ? "text-coral-600" : "text-ink-700"
            )}
          >
            <Heart size={16} aria-hidden="true" className={comment.likedByMe ? "fill-coral-600" : undefined} />
            <span className="num">{comment.likeCount}</span>
          </button>
        ) : (
          <span className="inline-flex min-h-11 items-center gap-1.5 px-1 text-small text-ink-500">
            <Heart size={16} aria-hidden="true" />
            <span className="num" aria-hidden="true">
              {comment.likeCount}
            </span>
            <span className="sr-only">{likesText}</span>
          </span>
        )}
        {canReply && (
          <button
            type="button"
            onClick={onToggleReply}
            className="inline-flex min-h-11 items-center rounded-field px-3 text-small font-semibold text-ink-700 hover:bg-ink-100"
          >
            {isReplying ? "Anuluj" : "Odpowiedz"}
          </button>
        )}
      </div>
    </article>
  );
}
