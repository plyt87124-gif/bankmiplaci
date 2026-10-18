import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AttributionCapture } from "@/components/AttributionCapture";
import { JsonLd } from "@/components/JsonLd";
import { TrustNote } from "@/components/trust/TrustNote";
import { BankLogo } from "@/components/ui/BankLogo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { breadcrumbLd, faqLd, itemListLd } from "@/lib/seo";
import { BANK_INDEX_FAQ, BANK_INDEX_RELATED, BANK_INDEX_SECTIONS } from "./bankIndexContent";
import { activeCountText, bankIndexLead, type BankIndexRow } from "./banks";
import { SeoEditorial } from "./SeoEditorial";

/**
 * /banki - the banks whose offers we analyse, alphabetically, each with the
 * number of CURRENT offers and a link to its permanent page. No offer cards and
 * no partner link here, so there is no disclosure strip; the scope note and the
 * "this is not a ranking" text are in place of one. Structured data:
 * BreadcrumbList + ItemList (the bank pages) + FAQPage from the shown FAQ.
 */
export function BankIndexPage({ banks }: { banks: readonly BankIndexRow[] }) {
  const structuredData = [
    breadcrumbLd([
      { name: "Start", path: "/" },
      { name: "Banki", path: "/banki" }
    ]),
    itemListLd(
      banks.map((bank) => ({ name: bank.name, path: `/banki/${bank.slug}` })),
      { name: "Banki z promocjami", limit: Math.max(banks.length, 1) }
    ),
    faqLd(BANK_INDEX_FAQ)
  ].filter((node): node is Record<string, unknown> => node !== null);

  return (
    <div className="container-page py-6 md:py-10">
      <AttributionCapture />
      <JsonLd data={structuredData} />

      <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Banki" }]} />

      <h1 className="mt-4 max-w-3xl">Banki z promocjami</h1>
      <p className="type-lead mt-3 max-w-2xl text-ink-700">{bankIndexLead(banks.length)}</p>

      <section aria-labelledby="lista-bankow" className="mt-8">
        <h2 id="lista-bankow" className="sr-only">
          Lista banków
        </h2>
        {banks.length > 0 ? (
          <ul role="list" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {banks.map((bank) => (
              <li key={bank.slug} className="flex min-w-0">
                <Link
                  href={`/banki/${bank.slug}`}
                  className="group flex w-full min-w-0 flex-col items-start gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-150 ease-out hover:border-line-strong hover:bg-sunken/40 sm:flex-row sm:items-center sm:gap-4"
                >
                  {/* The name is real text next to the logo, so the image is hidden from assistive technology.
                      On a phone the logo sits above the name: a long name keeps the whole tile width. */}
                  <span aria-hidden="true">
                    <BankLogo name={bank.name} logoUrl={bank.logoUrl} size="sm" />
                  </span>
                  <span className="flex w-full min-w-0 flex-1 items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink-900 [overflow-wrap:anywhere]">{bank.name}</span>
                      <span className="num block text-small text-ink-700">{activeCountText(bank.activeCount)}</span>
                    </span>
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 text-action transition-transform duration-base ease-out group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-prose text-ui text-ink-700">
            Nie mamy teraz banków z promocjami do pokazania. Zajrzyj do{" "}
            <Link href="/promocje" className="link-inline font-medium">
              listy promocji
            </Link>
            .
          </p>
        )}
      </section>


      <div className="mt-16 border-t border-line pt-12 md:mt-20 md:pt-16">
        <SeoEditorial sections={BANK_INDEX_SECTIONS} faq={BANK_INDEX_FAQ} related={BANK_INDEX_RELATED} />
      </div>
    </div>
  );
}
