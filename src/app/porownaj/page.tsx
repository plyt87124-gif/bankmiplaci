import type { Metadata } from "next";
import Link from "next/link";
import { listActivePromotions } from "@/lib/services/promotions";
import { formatPLN, formatDate, DIFFICULTY_LABEL } from "@/lib/format";
import { EmptyState } from "@/components/States";
import { CompareFilters } from "./CompareFilters";
import { PageViewTracker } from "@/components/PageViewTracker";
import { AttributionCapture } from "@/components/AttributionCapture";

export const metadata: Metadata = {
  title: "Porównaj konta bankowe",
  description: "Zestawienie aktualnych promocji bankowych obok siebie: premia, trudność, koszty i termin.",
  alternates: { canonical: "/porownaj" }
};

export default async function ComparePage({ searchParams }: { searchParams: { hideBusiness?: string } }) {
  const promotions = await listActivePromotions({ sort: "top-rated" });
  const hideBusiness = searchParams.hideBusiness === "1";
  const filtered = hideBusiness ? promotions.filter((p) => p.accountType !== "BUSINESS") : promotions;
  const compareSet = filtered.slice(0, 4);

  return (
    <div className="container-page py-12">
      <PageViewTracker />
      <AttributionCapture />
      <h1 className="text-3xl font-semibold">Porównaj konta bankowe</h1>
      <p className="mt-2 max-w-xl text-ink-500">
        Cztery najwyżej oceniane aktualne promocje zestawione obok siebie. Pełną listę znajdziesz na stronie{" "}
        <Link href="/promocje" className="text-teal-700 underline">
          wszystkich promocji
        </Link>
        .
      </p>

      <CompareFilters />

      {compareSet.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Brak promocji do porównania"
            description={hideBusiness ? "Brak promocji na konta osobiste przy tym filtrze." : "Baza promocji jest obecnie pusta."}
          />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="p-4 font-medium text-ink-500">Bank</th>
                {compareSet.map((p) => (
                  <th key={p.id} className="p-4 font-medium text-ink-900">
                    {p.bank.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Premia", render: (p: (typeof compareSet)[number]) => formatPLN(p.maxBonusCents) },
                { label: "Trudność", render: (p: (typeof compareSet)[number]) => DIFFICULTY_LABEL[p.difficulty] },
                { label: "Ocena", render: (p: (typeof compareSet)[number]) => `${Number(p.rating).toFixed(1)}/10` },
                {
                  label: "Koszt konta",
                  render: (p: (typeof compareSet)[number]) =>
                    p.fees && p.fees.accountFeeCents > 0 ? formatPLN(p.fees.accountFeeCents) : "0 zł*"
                },
                { label: "Koniec promocji", render: (p: (typeof compareSet)[number]) => formatDate(p.endDate) }
              ].map((row) => (
                <tr key={row.label} className="border-b border-ink-100 last:border-0">
                  <td className="p-4 font-medium text-ink-700">{row.label}</td>
                  {compareSet.map((p) => (
                    <td key={p.id} className="p-4 text-ink-900">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-4" />
                {compareSet.map((p) => (
                  <td key={p.id} className="p-4">
                    <Link href={`/promocje/${p.slug}`} className="text-sm font-medium text-teal-700 hover:underline">
                      Zobacz szczegóły →
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
