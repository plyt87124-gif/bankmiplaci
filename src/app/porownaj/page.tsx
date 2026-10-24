import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ViewerFilterNote } from "@/components/ViewerFilterNote";
import { AttributionCapture } from "@/components/AttributionCapture";
import { JsonLd } from "@/components/JsonLd";
import { TrustNote } from "@/components/trust/TrustNote";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { COOLDOWN_EXPLAINER } from "@/components/promocja/offerModel";
import { pluralizePl } from "@/lib/format";
import { breadcrumbLd, noindexForSearchParams, staticPageMetadata } from "@/lib/seo";
import { listPromotionCards } from "@/lib/services/promotionCards";
import { CompareControls } from "./CompareControls";
import { CompareTable } from "./CompareTable";
import { COMPARE_MAX, resolveSelection, segmentOf } from "./compareModel";
import { loadCompareExtras } from "./data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Every query (`typ`, `oferty`, ...) is a duplicate view of /porownaj:
 * noindex,follow, canonical = the clean path (staticPageMetadata sets it).
 */
export async function generateMetadata(props: { searchParams: SearchParams }): Promise<Metadata> {
  const searchParams = await props.searchParams;
  return staticPageMetadata("porownaj", { robots: noindexForSearchParams(searchParams, ["oferty"]) });
}

const CRUMBS = [
  { label: "Start", href: "/" },
  { label: "Porównanie promocji" }
];

export default async function ComparePage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;

  // Best rating first: that is the order of the pick list and of the table columns.
  const cards = await listPromotionCards({ sort: "top-rated" });
  const { segment, pool, selected, isDefault } = resolveSelection(cards, {
    typ: searchParams.typ,
    oferty: searchParams.oferty
  });
  const extras = await loadCompareExtras(selected.map((c) => c.slug));
  const columns = selected.map((card) => ({ card, extras: extras.get(card.slug) }));

  const counts = {
    PERSONAL: cards.filter((c) => segmentOf(c.accountType) === "PERSONAL").length,
    BUSINESS: cards.filter((c) => segmentOf(c.accountType) === "BUSINESS").length
  };
  const options = pool.map((c) => ({ slug: c.slug, bank: c.bank.name, name: c.name }));
  const k = selected.length;
  // One full compact disclosure (with its link) under the table; each button carries the short form.
  const hasPartnerLink = columns.some((c) => c.extras?.affiliateLinkEnabled === true);

  return (
    <div className="container-page py-8 md:py-12">
      <AttributionCapture />
      <JsonLd
        data={breadcrumbLd([
          { name: "Start", path: "/" },
          { name: "Porównanie promocji", path: "/porownaj" }
        ])}
      />
      <Breadcrumbs items={CRUMBS} />
      <h1 className="mt-4">Porównanie promocji</h1>
      <p className="type-lead mt-3 max-w-[44rem] text-ink-700">
        {k > 0
          ? `Porównujesz ${k} ${pluralizePl(k, "ofertę", "oferty", "ofert")} z ${pool.length} ${pluralizePl(pool.length, "aktualnej promocji", "aktualnych promocji", "aktualnych promocji")} w tej grupie. `
          : "Zestawiamy promocje w jednej tabeli: premia, termin, trudność, opłaty i ocena serwisu. "}
        {isDefault && k > 0
          ? `Domyślnie pokazujemy ${COMPARE_MAX} oferty o najwyższej ocenie serwisu; możesz wybrać inne.`
          : ""}
      </p>

      <div className="mt-6">
        <CompareControls
          segment={segment}
          counts={counts}
          options={options}
          selected={selected.map((c) => c.slug)}
          isDefault={isDefault}
        />
      </div>

      <AffiliateDisclosure variant="strip" sort="top-rated" className="mt-6" />
      <ViewerFilterNote />

      {columns.length === 0 ? (
        <div className="mt-6 rounded-card border border-line bg-sunken p-6" role="status">
          <p className="text-h4 font-semibold text-ink-900">Brak promocji do porównania w tej grupie</p>
          <p className="mt-1 text-ui text-ink-700">
            Nie mamy teraz aktualnych promocji dla wybranego rodzaju konta. Zajrzyj do pełnej listy.
          </p>
          <ButtonLink href="/promocje" variant="secondary" className="mt-4">
            Zobacz wszystkie promocje
          </ButtonLink>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <CompareTable columns={columns} />
          </div>

          <ul className="mt-5 space-y-1.5 text-small text-ink-500">
            <li className="flex items-start gap-2">
              <Check size={14} aria-hidden="true" className="mt-[5px] shrink-0 text-ink-700" />
              <span>
                Pogrubiona wartość z ptaszkiem to najlepsza w swoim wierszu spośród wybranych ofert (przy remisie
                oznaczamy wszystkie). Dotyczy jednej wartości, nie całej oferty.
              </span>
            </li>
            <li>
              Premia „do”: kwota to maksimum, które można uzyskać po spełnieniu wszystkich warunków promocji.
              Szczegóły warunków znajdziesz na stronie oferty.
            </li>
            <li>* Po spełnieniu warunku opłata wynosi 0 zł. Warunek podajemy pod kwotą.</li>
            <li>{COOLDOWN_EXPLAINER}</li>
            <li>Brak danych: nie zweryfikowaliśmy tej informacji. Sprawdź regulamin lub tabelę opłat banku.</li>
          </ul>
          {hasPartnerLink ? <AffiliateDisclosure variant="compact" className="mt-1.5" /> : null}
        </>
      )}

    </div>
  );
}
