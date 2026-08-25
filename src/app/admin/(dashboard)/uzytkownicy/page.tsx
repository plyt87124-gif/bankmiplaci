import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ActivityProvider } from "./ActivityProvider";
import { ActivityDot } from "./ActivityDot";

const ACTIVE_WINDOW_DAYS = 30;

export default async function AdminUsersPage({ searchParams }: { searchParams: { active?: string } }) {
  const showActiveOnly = searchParams.active === "1";
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [totalCount, activeCount, users] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lastLoginAt: { gte: activeSince } } }),
    db.user.findMany({
      where: showActiveOnly ? { lastLoginAt: { gte: activeSince } } : {},
      orderBy: { createdAt: "desc" },
      include: {
        clicks: { orderBy: { createdAt: "desc" }, take: 5, include: { promotion: { include: { bank: true } } } },
        impressions: { orderBy: { createdAt: "desc" }, take: 5, include: { promotion: { include: { bank: true } } } },
        _count: { select: { clicks: true, comments: true, impressions: true } }
      }
    })
  ]);

  return (
    <ActivityProvider initialUsers={users.map((u) => ({ id: u.id, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}>
      <div>
        <h1 className="text-2xl font-semibold">Użytkownicy</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
          <span className="inline-flex h-2 w-2 rounded-full bg-teal-500" />
          {activeCount} aktywnych (zalogowani w ciągu ostatnich {ACTIVE_WINDOW_DAYS} dni) z {totalCount} wszystkich kont.
        </p>

        <div className="mt-4 flex gap-2">
          <Link
            href="/admin/uzytkownicy"
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${!showActiveOnly ? "bg-ink-solid text-white" : "bg-ink-100 text-ink-700"}`}
          >
            Wszyscy ({totalCount})
          </Link>
          <Link
            href="/admin/uzytkownicy?active=1"
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${showActiveOnly ? "bg-ink-solid text-white" : "bg-ink-100 text-ink-700"}`}
          >
            Tylko aktywni ({activeCount})
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {users.map((user) => (
            <details key={user.id} className="rounded-xl2 border border-ink-100 bg-surface p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2.5">
                  <ActivityDot userId={user.id} />
                  <div>
                    <p className="font-medium text-ink-900">{user.name || user.username || user.email}</p>
                    <p className="text-xs text-ink-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-ink-500">
                  <span>{user._count.impressions} wyświetleń</span>
                  <span>{user._count.clicks} kliknięć</span>
                  <span>{user._count.comments} komentarzy</span>
                  <span>Ostatnio zalogowany: {user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}</span>
                </div>
              </summary>

              <div className="mt-4 grid gap-6 border-t border-ink-100 pt-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold text-ink-500">Ostatnio oglądane promocje</p>
                  {user.impressions.length === 0 ? (
                    <p className="text-xs text-ink-500">Brak zarejestrowanych wyświetleń.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {user.impressions.map((imp) => (
                        <li key={imp.id} className="flex items-center justify-between">
                          <span>{imp.promotion.bank.name} — {imp.promotion.name}</span>
                          <span className="text-ink-300">{formatDate(imp.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-ink-500">Kliknięcia „Przejdź do promocji”</p>
                  {user.clicks.length === 0 ? (
                    <p className="text-xs text-ink-500">Brak kliknięć w link partnerski.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {user.clicks.map((click) => (
                        <li key={click.id} className="flex items-center justify-between">
                          <span>{click.promotion.bank.name} — {click.promotion.name}</span>
                          <span className="text-ink-300">{formatDate(click.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </details>
          ))}

          {users.length === 0 && (
            <p className="rounded-xl2 border border-dashed border-ink-100 bg-surface p-8 text-center text-sm text-ink-500">
              {showActiveOnly ? "Brak aktywnych użytkowników w tym okresie." : "Nikt jeszcze nie założył konta."}
            </p>
          )}
        </div>
      </div>
    </ActivityProvider>
  );
}
