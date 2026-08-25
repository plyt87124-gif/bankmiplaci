import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { deleteComment, pinComment, unpinComment, postAdminReply } from "./actions";
import { Trash2, Pin, PinOff } from "lucide-react";

export default async function AdminCommentsPage() {
  const comments = await db.comment.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true, admin: true, promotion: { include: { bank: true } }, parent: true }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Komentarze</h1>
      <p className="mt-1 text-sm text-ink-500">{comments.length} komentarzy pod wszystkimi promocjami.</p>

      <div className="mt-6 space-y-3">
        {comments.map((c) => {
          const authorLabel = c.admin ? `${c.admin.name} (Admin)` : c.user?.name || c.user?.email || "Usunięty użytkownik";
          return (
            <div
              key={c.id}
              className={`rounded-xl2 border p-4 ${c.isPinned ? "border-gold-600 bg-gold-100/40" : "border-ink-100 bg-surface"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-sm font-medium ${c.admin ? "text-teal-700" : "text-ink-900"}`}>
                    {authorLabel}
                    {c.isPinned && <span className="ml-2 text-xs font-normal text-gold-600">📌 przypięty</span>}
                  </p>
                  <p className="text-xs text-ink-500">
                    {c.parentId ? "odpowiedź " : ""}pod{" "}
                    <Link href={`/promocje/${c.promotion.slug}`} target="_blank" className="text-teal-700 hover:underline">
                      {c.promotion.bank.name} — {c.promotion.name}
                    </Link>{" "}
                    · {formatDate(c.createdAt)}
                    {c.parent && <span> · w odpowiedzi na: „{c.parent.body.slice(0, 60)}{c.parent.body.length > 60 ? "…" : ""}”</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {!c.parentId && (
                    <form action={c.isPinned ? unpinComment.bind(null, c.id) : pinComment.bind(null, c.id, c.promotionId)}>
                      <button className="text-ink-300 hover:text-gold-600" title={c.isPinned ? "Odepnij" : "Przypnij"}>
                        {c.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </button>
                    </form>
                  )}
                  <form action={deleteComment.bind(null, c.id)}>
                    <button className="text-ink-300 hover:text-coral-600" title="Usuń komentarz">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">{c.body}</p>

              {!c.parentId && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-teal-700">Odpowiedz jako admin</summary>
                  <form action={postAdminReply} className="mt-2 flex gap-2">
                    <input type="hidden" name="parentId" value={c.id} />
                    <input type="hidden" name="promotionId" value={c.promotionId} />
                    <textarea
                      name="body"
                      rows={2}
                      required
                      placeholder="Odpowiedź widoczna publicznie, wyróżniona jako komentarz Bankmiplaci..."
                      className="flex-1 rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-teal-500"
                    />
                    <button className="self-start rounded-full bg-ink-solid px-4 py-2 text-xs font-medium text-white hover:bg-teal-700">
                      Wyślij
                    </button>
                  </form>
                </details>
              )}
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="rounded-xl2 border border-dashed border-ink-100 bg-surface p-8 text-center text-sm text-ink-500">
            Brak komentarzy.
          </p>
        )}
      </div>
    </div>
  );
}
