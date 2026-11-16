import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getFooterColumns } from "@/lib/navigation";

const footerLinkClasses =
  "inline-flex min-h-11 items-center py-1 text-small text-ink-700 hover:text-ink-900 hover:underline hover:underline-offset-[3px] md:min-h-8";

/**
 * The presentational footer: brand line and the link columns from
 * src/lib/navigation.ts. No database, no company data, no disclosure paragraph
 * (the owner removed that block from the redesign).
 */
export function FooterView() {
  const columns = getFooterColumns();

  return (
    <footer className="footer-money border-t border-line bg-surface">
      <div className="container-page py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <div>
            <p>
              <Logo height={28} />
            </p>
            <p className="mt-3 max-w-sm text-small text-ink-500">
              Porównujemy aktualne promocje bankowe w Polsce i pokazujemy, ile możesz otrzymać i co musisz zrobić, aby
              zdobyć premię.
            </p>
          </div>

          <nav aria-label="Stopka" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="font-body text-small font-semibold tracking-normal text-ink-900">{column.title}</h2>
                <ul className="mt-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={footerLinkClasses}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

/** Site footer: brand line and the link columns (exactly one <footer> in the HTML). */
export function Footer() {
  return <FooterView />;
}
