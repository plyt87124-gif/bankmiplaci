import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { deleteComment } from "../../komentarze/actions";
import { sendPasswordResetLink } from "../actions";
import { DeleteUserButton } from "./DeleteUserButton";
import { ArrowLeft, KeyRound, CheckCircle2, Circle, MailCheck, MousePointerClick } from "lucide-react";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const user = await db.user.findUnique({ where: { id: params.id } });
  if (!user) notFound();

  const [trackings, checkedProgress, bankHistory, impressions, clicks, comments] = await Promise.all([
    db.userPromotionTracking.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: "desc" },
      include: {
        promotion: {
          include: { bank: true, checklistSteps: { select: { id: true, rewardCents: true } } }
        }
      }
    }),
    db.checklistProgress.findMany({ where: { userId: user.id }, select: { stepId: true } }),
    db.userBankHistory.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { bank: true, eligibilityPromotion: { select: { name: true, slug: true } } }
    }),
    db.impression.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { promotion: { include: { bank: true } } }
    }),
    db.click.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { promotion: { include: { bank: true } } }
    }),
    db.comment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { promotion: { select: { slug: true, name: true } } }
    })
  ]);

  const checkedStepIds = new Set(checkedProgress.map((c) => c.stepId));

  const eligibilityTokens = bankHistory.map((r) => r.eligibilityEmailToken).filter((t): t is string => !!t);
  const ctaClicks =
    eligibilityTokens.length > 0
      ? await db.click.findMany({
          where: { campaign: { in: eligibilityTokens } },
          orderBy: { createdAt: "asc" },
          select: { campaign: true, createdAt: true }
        })
      : [];
  const ctaClickedAtByToken = new Map<string, Date>();
  for (const c of ctaClicks) {
    if (c.campaign && !ctaClickedAtByToken.has(c.campaign)) ctaClickedAtByToken.set(c.campaign, c.createdAt);
  }

  const userLabel = user.name || user.username || user.email;

  return (
    <div>
      <Link href="/admin/uzytkownicy" className="flex items-center gap-1.5 text-sm text-ink-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Wszyscy użytkownicy
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{userLabel}</h1>
          <p className="mt-1 text-sm text-ink-500">{user.email}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
            <span>Rejestracja: {formatDate(user.createdAt)}</span>
            <span>Ostatnie logowanie: {user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}</span>
            {user.username && <span>Login: {user.username}</span>}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <form action={sendPasswordResetLink.bind(null, user.id)}>
            <button className="flex items-center gap-1.5 rounded-full border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
              <KeyRound className="h-4 w-4" /> Wyślij link do resetu hasła
            </button>
          </form>
          <DeleteUserButton userId={user.id} userLabel={userLabel} />
        </div>
      </div>

      {/* Ściągi */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Ściągi z promocji ({trackings.length})</h2>
        {trackings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Nie śledzi żadnej promocji.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {trackings.map((t) => {
              const actionSteps = t.promotion.checklistSteps.filter((s) => s.rewardCents === null);
              const checkedCount = actionSteps.filter((s) => checkedStepIds.has(s.id)).length;
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl2 border border-ink-100 bg-surface p-4 text-sm">
                  <div>
                    <Link href={`/promocje/${t.promotion.slug}`} target="_blank" className="font-medium text-ink-900 hover:underline">
                      {t.promotion.bank.name} — {t.promotion.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Dołączył/a: {formatDate(t.joinedAt)}
                      {t.completedAt && ` · Zamknięte: ${formatDate(t.completedAt)}`}
                      {t.accountOpenedAt && ` · Konto otwarte: ${formatDate(t.accountOpenedAt)}`}
                    </p>
                  </div>
                  <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700">
                    {checkedCount}/{actionSteps.length} kroków
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Karencja */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Historia bankowa i karencja ({bankHistory.length})</h2>
        {bankHistory.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Brak zapisanych dat zamknięcia konta.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl2 border border-ink-100">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="p-3">Bank / konto</th>
                  <th className="p-3">Klient do</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Kliknął link</th>
                  <th className="p-3">Kliknął „Przejdź do promocji”</th>
                </tr>
              </thead>
              <tbody>
                {bankHistory.map((row) => {
                  const ctaClickedAt = row.eligibilityEmailToken ? ctaClickedAtByToken.get(row.eligibilityEmailToken) : undefined;
                  return (
                    <tr key={row.id} className="border-b border-ink-100 last:border-0">
                      <td className="p-3">
                        <p className="text-ink-900">{row.bank.name}</p>
                        <p className="text-xs text-ink-500">{row.accountType}</p>
                      </td>
                      <td className="p-3 text-ink-700">{row.wasClientUntil ? formatDate(row.wasClientUntil) : "—"}</td>
                      <td className="p-3">
                        {row.eligibilityNotifiedAt ? (
                          <span className="flex items-center gap-1.5 text-teal-700">
                            <MailCheck className="h-4 w-4" /> {formatDate(row.eligibilityNotifiedAt)}
                          </span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {row.eligibilityLinkClickedAt ? (
                          <span className="flex items-center gap-1.5 text-teal-700">
                            <CheckCircle2 className="h-4 w-4" /> {formatDate(row.eligibilityLinkClickedAt)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-ink-300">
                            <Circle className="h-4 w-4" /> —
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {ctaClickedAt ? (
                          <span className="flex items-center gap-1.5 text-teal-700">
                            <MousePointerClick className="h-4 w-4" /> {formatDate(ctaClickedAt)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-ink-300">
                            <Circle className="h-4 w-4" /> —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Comments */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Komentarze ({comments.length})</h2>
        {comments.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Nie napisał/a jeszcze komentarza.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="rounded-xl2 border border-ink-100 bg-surface p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/promocje/${c.promotion.slug}`} target="_blank" className="text-xs font-medium text-teal-700 hover:underline">
                      {c.promotion.name}
                    </Link>
                    <p className="mt-1 text-ink-700">{c.body}</p>
                    <p className="mt-1 text-xs text-ink-300">{formatDate(c.createdAt)}{c.isPinned && " · przypięty"}</p>
                  </div>
                  <form action={deleteComment.bind(null, c.id)}>
                    <button className="shrink-0 text-xs font-medium text-coral-600 hover:underline">Usuń</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Impressions & clicks */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-ink-900">Ostatnio oglądane promocje (do 50)</h2>
          {impressions.length === 0 ? (
            <p className="mt-2 text-xs text-ink-500">Brak zarejestrowanych wyświetleń.</p>
          ) : (
            <ul className="mt-2 max-h-96 space-y-1.5 overflow-y-auto text-xs">
              {impressions.map((imp) => (
                <li key={imp.id} className="flex items-center justify-between gap-2 border-b border-ink-100 pb-1.5">
                  <span>{imp.promotion.bank.name} — {imp.promotion.name}</span>
                  <span className="shrink-0 text-ink-300">{formatDate(imp.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="text-sm font-semibold text-ink-900">Kliknięcia „Przejdź do promocji” (do 50)</h2>
          {clicks.length === 0 ? (
            <p className="mt-2 text-xs text-ink-500">Brak kliknięć w link partnerski.</p>
          ) : (
            <ul className="mt-2 max-h-96 space-y-1.5 overflow-y-auto text-xs">
              {clicks.map((click) => (
                <li key={click.id} className="flex items-center justify-between gap-2 border-b border-ink-100 pb-1.5">
                  <span>{click.promotion.bank.name} — {click.promotion.name}</span>
                  <span className="shrink-0 text-ink-300">{formatDate(click.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
