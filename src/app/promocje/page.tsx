import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listActivePromotions } from "@/lib/services/promotions";
import { PromotionCard } from "@/components/PromotionCard";
import { Filters } from "@/components/Filters";
import { NoResultsState } from "@/components/States";
import { AttributionCapture } from "@/components/AttributionCapture";
import type { SortKey } from "@/lib/services/promotions";

export const metadata: Metadata = {
  title: "Wszystkie promocje bankowe",
  description: "Porównaj wszystkie aktualne promocje bankowe w Polsce: premie za otwarcie konta, wymagania i koszty.",
  alternates: { canonical: "/promocje" }
};

interface PageProps {
  searchParams: {
    q?: string;
    bank?: string;
    accountType?: string;
    difficulty?: string;
    minBonus?: string;
    noFees?: string;
    sort?: string;
  };
}

export default async function PromotionsPage({ searchParams }: PageProps) {
  const [promotions, banks] = await Promise.all([
    listActivePromotions({
      q: searchParams.q,
      bankSlug: searchParams.bank,
      accountType: searchParams.accountType,
      difficulty: searchParams.difficulty?.split(",").filter(Boolean),
      minBonusCents: searchParams.minBonus ? Number(searchParams.minBonus) : undefined,
      maxAccountFeeCents: searchParams.noFees === "1" ? 0 : undefined,
      sort: searchParams.sort as SortKey | undefined
    }),
    db.bank.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } })
  ]);

  return (
    <div className="container-page py-12">
      <AttributionCapture />
      <nav aria-label="breadcrumb" className="text-xs text-ink-500">
        <a href="/" className="hover:underline">
          Strona główna
        </a>{" "}
        / <span className="text-ink-700">Promocje</span>
      </nav>

      <h1 className="mt-3 text-3xl font-semibold">Wszystkie promocje bankowe</h1>
      <p className="mt-2 max-w-xl text-ink-500">
        {promotions.length} {promotions.length === 1 ? "aktualna promocja" : "aktualnych promocji"} spełniających
        wybrane kryteria.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <Filters banks={banks} />

        <div>
          {promotions.length === 0 ? (
            <NoResultsState query={searchParams.q} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {promotions.map((p) => (
                <PromotionCard key={p.id} promotion={{ ...p, rating: Number(p.rating) }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
