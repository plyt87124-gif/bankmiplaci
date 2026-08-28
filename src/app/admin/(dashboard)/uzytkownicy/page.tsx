import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ActivityProvider } from "./ActivityProvider";
import { ActivityDot } from "./ActivityDot";
import { Download } from "lucide-react";

const ACTIVE_WINDOW_DAYS = 30;
const PAGE_SIZE = 25;

type SortKey = "newest" | "active" | "engagement";

interface SearchParams {
  active?: string;
  q?: string;
  sort?: string;
  page?: string;
}

function sortToOrderBy(sort: SortKey): Prisma.UserOrderByWithRelationInput {
  switch (sort) {
    case "active":
      return { lastLoginAt: "desc" };
    case "engagement":
      return { clicks: { _count: "desc" } };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const showActiveOnly = searchParams.active === "1";
  const q = searchParams.q?.trim() || "";
  const sort: SortKey = searchParams.sort === "active" || searchParams.sort === "engagement" ? searchParams.sort : "newest";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const where: Prisma.UserWhereInput = {
    ...(showActiveOnly ? { lastLoginAt: { gte: activeSince } } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [totalCount, activeCount, filteredCount, users] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lastLoginAt: { gte: activeSince } } }),
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { clicks: true, comments: true, impressions: true, promotionTracking: true } }
      }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (showActiveOnly) baseParams.set("active", "1");
  if (sort !== "newest") baseParams.set("sort", sort);
  const qs = baseParams.toString();

  function pageHref(p: number) {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/admin/uzytkownicy${s ? `?${s}` : ""}`;
  }

  function clearSearchHref() {
    const params = new URLSearchParams(baseParams);
    params.delete("q");
    const s = params.toString();
    return `/admin/uzytkownicy${s ? `?${s}` : ""}`;
  }

  function sortHref(s: SortKey) {
    const params = new URLSearchParams(baseParams);
    if (s === "newest") params.delete("sort");
    else params.set("sort", s);
    params.delete("page");
    const str = params.toString();
    return `/admin/uzytkownicy${str ? `?${str}` : ""}`;
  }

  return (
    <ActivityProvider initialUsers={users.map((u) => ({ id: u.id, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Użytkownicy</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
              <span className="inline-flex h-2 w-2 rounded-full bg-teal-500" />
              {activeCount} aktywnych (zalogowani w ciągu ostatnich {ACTIVE_WINDOW_DAYS} dni) z {totalCount} wszystkich kont.
            </p>
          </div>
          <a
            href={`/api/admin/users/export${qs ? `?${qs}` : ""}`}
            className="flex items-center gap-1.5 rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
          >
            <Download className="h-3.5 w-3.5" /> Eksportuj CSV
          </a>
        </div>

        <form action="/admin/uzytkownicy" className="mt-4 flex items-center gap-2">
          {showActiveOnly && <input type="hidden" name="active" value="1" />}
          {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Szukaj po e-mailu, imieniu lub nazwie użytkownika…"
            className="w-full max-w-sm rounded-full border border-ink-100 bg-surface px-4 py-2 text-sm outline-none focus:border-teal-500"
          />
          <button className="rounded-full bg-ink-solid px-4 py-2 text-xs font-medium text-white hover:bg-teal-700">Szukaj</button>
          {q && (
            <Link href={clearSearchHref()} className="text-xs text-ink-500 hover:underline">
              Wyczyść
            </Link>
          )}
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={q ? `/admin/uzytkownicy?q=${encodeURIComponent(q)}` : "/admin/uzytkownicy"}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${!showActiveOnly ? "bg-ink-solid text-white" : "bg-ink-100 text-ink-700"}`}
          >
            Wszyscy ({totalCount})
          </Link>
          <Link
            href={`/admin/uzytkownicy?active=1${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${showActiveOnly ? "bg-ink-solid text-white" : "bg-ink-100 text-ink-700"}`}
          >
            Tylko aktywni ({activeCount})
          </Link>
          <span className="mx-1 h-5 w-px bg-ink-100" />
          <Link href={sortHref("newest")} className={`rounded-full px-3 py-1.5 text-xs font-medium ${sort === "newest" ? "bg-ink-solid text-white" : "bg-ink-100 text-ink-700"}`}>
            Najnowsi
          </Link>
          <Link href={sortHref("active")} className={`rounded-full px-3 py-1.5 text-xs font-medium ${sort === "active" ? "bg-ink-solid text-white" : "bg-ink-100 text-ink-700"}`}>
            Ostatnio aktywni
          </Link>
          <Link href={sortHref("engagement")} className={`rounded-full px-3 py-1.5 text-xs font-medium ${sort === "engagement" ? "bg-ink-solid text-white" : "bg-ink-100 text-ink-700"}`}>
            Najbardziej zaangażowani
          </Link>
        </div>

        <div className="mt-6 space-y-2">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/admin/uzytkownicy/${user.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-ink-100 bg-surface p-4 text-sm hover:border-teal-500"
            >
              <div className="flex items-center gap-2.5">
                <ActivityDot userId={user.id} />
                <div>
                  <p className="font-medium text-ink-900">{user.name || user.username || user.email}</p>
                  <p className="text-xs text-ink-500">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-500">
                <span>Rejestracja: {formatDate(user.createdAt)}</span>
                <span>{user._count.impressions} wyświetleń</span>
                <span>{user._count.clicks} kliknięć</span>
                <span>{user._count.comments} komentarzy</span>
                <span>{user._count.promotionTracking} ściąg</span>
                <span>Ostatnio zalogowany: {user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}</span>
              </div>
            </Link>
          ))}

          {users.length === 0 && (
            <p className="rounded-xl2 border border-dashed border-ink-100 bg-surface p-8 text-center text-sm text-ink-500">
              {q ? "Brak wyników dla tego wyszukiwania." : showActiveOnly ? "Brak aktywnych użytkowników w tym okresie." : "Nikt jeszcze nie założył konta."}
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Link
              href={pageHref(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${page <= 1 ? "pointer-events-none bg-ink-100 text-ink-300" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
            >
              ← Poprzednia
            </Link>
            <span className="text-xs text-ink-500">
              Strona {page} z {totalPages}
            </span>
            <Link
              href={pageHref(Math.min(totalPages, page + 1))}
              aria-disabled={page >= totalPages}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${page >= totalPages ? "pointer-events-none bg-ink-100 text-ink-300" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
            >
              Następna →
            </Link>
          </div>
        )}
      </div>
    </ActivityProvider>
  );
}
