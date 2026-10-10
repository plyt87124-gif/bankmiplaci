import Link from "next/link";
import { HOME_TRUST_COLUMNS } from "./homeContent";

/**
 * "Dlaczego możesz nam ufać" (layout spec, HOME block 6): three claims in
 * columns separated by hairlines (rows on a phone). Each one names what we do
 * and links to the page that explains it in full; the wording of the
 * commission claims comes from lib/disclosureCopy.ts. No invented figures,
 * partners or endorsements.
 */
export function HomeTrust() {
  return (
    <section aria-labelledby="zaufanie-title" className="container-page py-12 md:py-24">
      <h2 id="zaufanie-title">Dlaczego możesz nam ufać</h2>
      <ul
        role="list"
        className="mt-8 grid divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0"
      >
        {HOME_TRUST_COLUMNS.map((column) => (
          <li key={column.id} className="py-6 md:px-6 md:first:pl-0 md:last:pr-0">
            <h3>{column.title}</h3>
            <p className="mt-2 text-article text-ink-700">{column.text}</p>
            <p className="mt-3 text-small">
              <Link href={column.link.href} className="link-inline inline-flex min-h-11 items-center font-medium">
                {column.link.label}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
