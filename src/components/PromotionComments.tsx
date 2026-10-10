"use client";

import { useEffect, useId, useRef, useState } from "react";
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

/* ------------------------------------------------------------------ */
/* Pure list logic (no React): covered by tests/checklist-ui.test.tsx.  */
/* ------------------------------------------------------------------ */

/** Comments plus replies - the number in the heading. */
export function countComments(comments: readonly CommentItem[]): number {
  return comments.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);
}

/** A new top-level comment goes to the top of the list, whatever the sort. */
export function withNewComment(comments: readonly CommentItem[] | null, comment: CommentItem): CommentItem[] {
  return [comment, ...(comments ?? [])];
}

/** Appends a reply under its parent; an unknown parent leaves the list as it was. */
export function withReply(comments: readonly CommentItem[], parentId: string, reply: CommentItem): CommentItem[] {
  return comments.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), reply] } : c));
}

/** Applies the server's like state to a comment (`parentId` = the comment it replies to, if it is a reply). */
export function withLikeState(
  comments: readonly CommentItem[],
  commentId: string,
  parentId: string | undefined,
  state: { likeCount: number; likedByMe: boolean }
): CommentItem[] {
  return comments.map((c) => {
    if (parentId) {
      if (c.id !== parentId) return c;
      return { ...c, replies: c.replies?.map((r) => (r.id === commentId ? { ...r, ...state } : r)) };
    }
    return c.id === commentId ? { ...c, ...state } : c;
  });
}

/**
 * The text of the live region above the list. `visible` = shown to everybody
 * (the very first load and a failed load); a re-sort only tells screen readers,
 * because the old list stays on screen until the new one arrives.
 */
export function commentsStatus(input: {
  loading: boolean;
  hasLoaded: boolean;
  loadFailed: boolean;
  sortedBy: string | null;
}): { text: string; visible: boolean } {
  if (input.loading && !input.hasLoaded) return { text: "Wczytywanie komentarzy...", visible: true };
  if (input.loading) return { text: "Sortowanie komentarzy...", visible: false };
  if (input.loadFailed) {
    return {
      text: input.hasLoaded
        ? "Nie udało się odświeżyć komentarzy. Pokazujemy poprzednią listę."
        : "Nie udało się wczytać komentarzy. Odśwież stronę, żeby spróbować ponownie.",
      visible: true
    };
  }
  if (input.sortedBy) return { text: `Komentarze posortowane: ${input.sortedBy}.`, visible: false };
  return { text: "", visible: false };
}

export function PromotionComments({
  promotionSlug,
  currentUser
}: {
  promotionSlug: string;
  currentUser: { email: string; name: string | null } | null;
}) {
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [sort, setSort] = useState<SortMode>("newest");
  // Loading is separate from `comments`: changing the sort keeps the old list (and the focused sort
  // button) on screen, marked aria-busy, and swaps it when the new answer arrives.
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sortedBy, setSortedBy] = useState<string | null>(null);
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

  const hasLoaded = comments !== null;
  // Only a sort the visitor chose is announced afterwards, not the first load.
  const sortChosen = useRef(false);

  useEffect(() => {
    // The newest request wins: a slower, older answer must not overwrite a newer one.
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    setSortedBy(null);
    fetch(`/api/promotions/${promotionSlug}/comments?sort=${sort}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("comments");
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setComments(data.comments ?? []);
        setLoading(false);
        if (sortChosen.current) setSortedBy(SORT_OPTIONS.find((o) => o.value === sort)?.label.toLowerCase() ?? null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadFailed(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [promotionSlug, sort]);

  function chooseSort(next: SortMode) {
    if (next === sort) return;
    sortChosen.current = true;
    setSort(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/promotions/${promotionSlug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setSubmitting(false);

    if (!res || !res.ok) {
      setError(data?.error ?? "Nie udało się dodać komentarza. Sprawdź połączenie i spróbuj ponownie.");
      return;
    }

    setComments((prev) => withNewComment(prev, data.comment));
    setBody("");
  }

  async function onReply(parentId: string) {
    if (!replyBody.trim()) return;
    setReplyError(null);
    const res = await fetch(`/api/promotions/${promotionSlug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody, parentId })
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok) {
      setReplyError(data?.error ?? "Nie udało się dodać odpowiedzi. Sprawdź połączenie i spróbuj ponownie.");
      return;
    }

    setComments((prev) => withReply(prev ?? [], parentId, data.comment));
    setReplyBody("");
    setReplyTo(null);
  }

  async function onLike(commentId: string, isReplyOf?: string) {
    if (!currentUser) return;
    const res = await fetch(`/api/promotions/${promotionSlug}/comments/${commentId}/like`, { method: "POST" }).catch(
      () => null
    );
    const data = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok) return;

    setComments((prev) =>
      withLikeState(prev ?? [], commentId, isReplyOf, { likeCount: data.likeCount, likedByMe: data.likedByMe })
    );
  }

  /** A guest has no reply form: the button opens the sign-in dialog instead of toggling a form that never appears. */
  function onToggleReply(commentId: string) {
    if (!currentUser) {
      openAuth({ mode: "login" });
      return;
    }
    setReplyError(null);
    setReplyTo(replyTo === commentId ? null : commentId);
  }

  const total = countComments(comments ?? []);
  const status = commentsStatus({ loading, hasLoaded, loadFailed, sortedBy });

  return (
    <section className="mt-12" aria-labelledby={`${baseId}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${baseId}-heading`} className="flex items-center gap-2">
          <MessageCircle size={24} aria-hidden="true" className="shrink-0 text-ink-500" />
          <span>Komentarze{hasLoaded ? ` (${total})` : ""}</span>
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
                  onClick={() => chooseSort(option.value)}
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

      <div className="mt-6">
        {/* Always in the DOM and outside the aria-busy container, so the text put into it is announced. */}
        <div role="status" className={cn("text-ui text-ink-500 empty:hidden", !status.visible && "sr-only")}>
          {status.text}
        </div>
        <div aria-busy={loading}>
          {comments?.length === 0 && <p className="text-ui text-ink-700">Nikt jeszcze nie skomentował tej promocji.</p>}
          {comments && comments.length > 0 && (
            <ul role="list" className="space-y-4">
              {comments.map((c) => (
                <li key={c.id}>
                  <CommentCard
                    comment={c}
                    canReply
                    isReplying={Boolean(currentUser) && replyTo === c.id}
                    onToggleReply={() => onToggleReply(c.id)}
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
