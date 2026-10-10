import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo/jsonld";

export type LegalSection = { id: string; label: string };

/**
 * Wspólny układ stron prawnych (regulamin, polityka prywatności, cookies).
 *
 * - kolumna czytania 44 rem, tekst 16/27, linki podkreślone (offset 3 px),
 * - spis treści: od lg lepki z boku, poniżej lg zwijany blok nad treścią,
 * - kotwice: każdy nagłówek z `id` ma scroll-margin (zob. także globals.css),
 * - okruszki (Start / tytuł) + BreadcrumbList JSON-LD z tych samych pozycji;
 *   ścieżka strony pochodzi z jawnego `path`, nie jest zgadywana z tytułu,
 * - akapity z datą (obowiązywania, ostatniej aktualizacji) wyciszone; strona
 *   oznacza je jawnie atrybutem `data-legal-date` na <p> (żaden inny akapit,
 *   także pierwszy czy ostatni z treści, nie jest wyciszany z racji położenia),
 * - treść prawna (children) przychodzi bez zmian ze stron; tu tylko oprawa.
 *
 * `sections` musi odpowiadać `id` nagłówków h2 w treści (pilnuje tego test).
 */
const bodyStyles = [
  "text-base leading-[1.6875rem] text-ink-700",
  // Akapit z datą obowiązywania / ostatniej aktualizacji (<p data-legal-date>) - wyciszony.
  "[&>p[data-legal-date]]:text-sm [&>p[data-legal-date]]:text-ink-500",
  "[&_h2]:mt-10 [&_h2]:scroll-mt-20 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-ink-900",
  "[&_h3]:mt-6 [&_h3]:scroll-mt-20 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink-900",
  "[&_p]:mt-3",
  "[&_strong]:font-semibold [&_strong]:text-ink-900",
  "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ul]:marker:text-ink-400",
  "[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ol]:marker:text-ink-500",
  "[&_li_ul]:mt-2 [&_li_ol]:mt-2",
  "[&_a]:font-medium [&_a]:text-action [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a:hover]:text-action-hover",
  "[&_table]:w-full [&_table]:min-w-[34rem] [&_table]:border-collapse [&_table]:text-sm [&_table]:leading-6",
  "[&_th]:border [&_th]:border-line [&_th]:bg-sunken [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-ink-900",
  "[&_td]:border [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
  "[&_code]:rounded [&_code]:bg-sunken [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_code]:text-ink-900"
].join(" ");

function TocList({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="space-y-1 text-sm leading-5">
      {sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="block rounded-md px-2 py-1.5 text-ink-700 underline decoration-1 underline-offset-[3px] hover:text-action"
          >
            {s.label}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function LegalPage({
  title,
  path,
  sections,
  children
}: {
  title: string;
  /** Ścieżka strony (np. "/regulamin"): ostatnia pozycja okruszków i BreadcrumbList JSON-LD. */
  path: string;
  sections?: LegalSection[];
  children: React.ReactNode;
}) {
  const hasToc = !!sections && sections.length > 1;
  const ld = breadcrumbLd([
    { name: "Start", path: "/" },
    { name: title, path }
  ]);
  return (
    <div className="container-page py-10 sm:py-14">
      <div className={hasToc ? "lg:grid lg:grid-cols-[minmax(0,44rem)_15rem] lg:justify-center lg:gap-14" : "mx-auto max-w-[44rem]"}>
        <div className="min-w-0">
          <JsonLd data={ld} />
          <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: title }]} className="mb-4" />
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">{title}</h1>

          {hasToc && (
            <details className="mt-6 rounded-lg border border-line bg-sunken lg:hidden">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-ink-900">
                Spis treści
              </summary>
              <nav aria-label="Spis treści" className="border-t border-line px-2 py-2">
                <TocList sections={sections!} />
              </nav>
            </details>
          )}

          <div className={`mt-6 ${bodyStyles}`}>{children}</div>
        </div>

        {hasToc && (
          <aside className="hidden lg:block">
            <nav
              aria-label="Spis treści"
              className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto border-l border-line pl-4"
            >
              <p className="mb-2 text-sm font-semibold text-ink-900">Spis treści</p>
              <TocList sections={sections!} />
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
}
