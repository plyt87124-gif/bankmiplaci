import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { listActivePromotions } from "@/lib/services/promotions";
import { formatPLN, formatDate, DIFFICULTY_LABEL } from "@/lib/format";
import { EmptyState } from "@/components/States";
import { CompareFilters } from "./CompareFilters";
import { AttributionCapture } from "@/components/AttributionCapture";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Porównaj konta bankowe",
  description: "Zestawienie aktualnych promocji bankowych obok siebie: premia, trudność, koszty i termin.",
  alternates: { canonical: "/porownaj" }
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = { PERSONAL: "Osobiste", BUSINESS: "Firmowe" };
const COUNT_VALUES = ["4", "8", "12", "all"] as const;

export default async function ComparePage({
  searchParams
}: {
  searchParams: { typ?: string; liczba?: string };
}) {
  const accountType = searchParams.typ === "PERSONAL" || searchParams.typ === "BUSINESS" ? searchParams.typ : undefined;
  const promotions = await listActivePromotions({ sort: "top-rated", accountType });

  const count = COUNT_VALUES.includes(searchParams.liczba as (typeof COUNT_VALUES)[number])
    ? (searchParams.liczba as (typeof COUNT_VALUES)[number])
    : "8";
  const compareSet = count === "all" ? promotions : promotions.slice(0, Number(count));
  const bestBonus = compareSet.length > 0 ? Math.max(...compareSet.map((p) => p.maxBonusCents)) : 0;

  type Row = (typeof compareSet)[number];
  const rows: { label: string; render: (p: Row) => ReactNode }[] = [
    {
      label: "Premia",
      render: (p) => (
        <span className={cn("font-mono font-semibold", p.maxBonusCents === bestBonus && "text-teal-700")}>
          {formatPLN(p.maxBonusCents)}
          {p.maxBonusCents === bestBonus && compareSet.length > 1 && (
            <span className="ml-2 whitespace-nowrap rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-700">
              najwyższa
            </span>
          )}
        </span>
      )
    },
    { label: "Typ konta", render: (p) => ACCOUNT_TYPE_LABEL[p.accountType] ?? p.accountType },
    { label: "Trudność", render: (p) => DIFFICULTY_LABEL[p.difficulty] },
    { label: "Ocena", render: (p) => <span className="font-mono">{Number(p.rating).toFixed(1)}/10</span> },
    {
      label: "Koszt konta",
      render: (p) => (p.fees && p.fees.accountFeeCents > 0 ? formatPLN(p.fees.accountFeeCents) : "0 zł*")
    },
    {
      label: "Koszt karty",
      render: (p) => (p.fees && p.fees.cardFeeCents > 0 ? formatPLN(p.fees.cardFeeCents) : "0 zł*")
    },
    { label: "Koniec promocji", render: (p) => formatDate(p.endDate) }
  ];

  return (
    <div className="container-page py-12">
      <AttributionCapture />
      <h1 className="text-3xl font-semibold">Porównaj konta bankowe</h1>
      <p className="mt-2 max-w-xl text-ink-500">
        {compareSet.length === promotions.length
          ? `Wszystkie ${promotions.length} aktualne promocje zestawione obok siebie.`
          : `${compareSet.length} z ${promotions.length} aktualnych promocji, posortowane wg oceny serwisu.`}{" "}
        Pełną listę znajdziesz na stronie{" "}
        <Link href="/promocje" className="text-teal-700 underline">
          wszystkich promocji
        </Link>
        .
      </p>

      <CompareFilters maxCount={promotions.length} />

      {compareSet.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Brak promocji do porównania"
            description="Brak promocji pasujących do wybranego filtra."
          />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="sticky left-0 z-10 min-w-[170px] bg-surface p-4 align-bottom font-medium text-ink-500">
                  &nbsp;
                </th>
                {compareSet.map((p) => (
                  <th key={p.id} className="min-w-[190px] border-l border-ink-100 p-0 align-top font-medium text-ink-900">
                    {/* Whole column is clickable through to the promotion —
                        the "Zobacz szczegóły →" button at the bottom stays
                        as an explicit, separate link (own new tab too). */}
                    <a
                      href={`/promocje/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 hover:bg-ink-100/40"
                    >
                      {p.bank.logoUrl ? (
                        <div className="relative h-7 w-24">
                          <Image src={p.bank.logoUrl} alt={p.bank.name} fill sizes="96px" className="object-contain object-left" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-ink-700">
                          <Building2 className="h-5 w-5 shrink-0 text-ink-400" />
                          <span className="font-display text-sm font-semibold">{p.bank.name}</span>
                        </div>
                      )}
                      <p className="mt-2 text-xs font-normal text-ink-500">{p.bank.name}</p>
                      <p className="line-clamp-2 font-display text-sm font-semibold">{p.name}</p>
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-ink-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-surface p-4 font-medium text-ink-700">{row.label}</td>
                  {compareSet.map((p) => (
                    <td key={p.id} className="border-l border-ink-100 p-0 text-ink-900">
                      <a
                        href={`/promocje/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 hover:bg-ink-100/40"
                      >
                        {row.render(p)}
                      </a>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 z-10 bg-surface p-4" />
                {compareSet.map((p) => (
                  <td key={p.id} className="border-l border-ink-100 p-4">
                    <Link
                      href={`/promocje/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center whitespace-nowrap rounded-full bg-teal-100 px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100/70"
                    >
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
