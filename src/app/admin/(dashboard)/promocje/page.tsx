import Link from "next/link";
import { db } from "@/lib/db";
import { formatPLN, formatDate } from "@/lib/format";
import { Plus, Eye } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Wersja robocza",
  ACTIVE: "Aktywna",
  EXPIRED: "Wygasła",
  ARCHIVED: "Zarchiwizowana"
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-ink-100 text-ink-700",
  ACTIVE: "bg-teal-100 text-teal-700",
  EXPIRED: "bg-coral-100 text-coral-600",
  ARCHIVED: "bg-ink-100 text-ink-500"
};

export default async function AdminPromotionsPage() {
  const promotions = await db.promotion.findMany({
    include: { bank: true },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Promocje</h1>
        <Link
          href="/admin/promocje/nowa"
          className="inline-flex items-center gap-2 rounded-full bg-ink-solid px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" /> Dodaj promocję
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-ink-500">
              <th className="p-3 font-medium">Promocja</th>
              <th className="p-3 font-medium">Premia</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Koniec</th>
              <th className="p-3 font-medium">Weryfikacja</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {promotions.map((p) => (
              <tr key={p.id} className="border-b border-ink-100 last:border-0">
                <td className="p-3">
                  <p className="font-medium text-ink-900">{p.bank.name}</p>
                  <p className="text-xs text-ink-500">{p.name}</p>
                </td>
                <td className="p-3">{formatPLN(p.maxBonusCents)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="p-3">{formatDate(p.endDate)}</td>
                <td className="p-3">{formatDate(p.lastVerifiedAt)}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <a
                      href={`/promocje/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-500 hover:text-ink-900"
                      title={p.status === "ACTIVE" ? "Zobacz na stronie" : "Podgląd (niepublikowana)"}
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <Link href={`/admin/promocje/${p.id}`} className="font-medium text-teal-700 hover:underline">
                      Edytuj
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {promotions.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink-500">
                  Brak promocji w bazie. Dodaj pierwszą, klikając „Dodaj promocję”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
