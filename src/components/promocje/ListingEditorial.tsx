import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { EDITORIAL_SECTIONS, LISTING_FAQ } from "@/components/promocje/editorialContent";

/**
 * Editorial block under the list: four short sections ("Jak działa konto z
 * premią?" ...) and the FAQ, in the 44 rem reading column. Server component;
 * the FAQ is native <details>, so every answer is in the HTML (and in the
 * FAQPage JSON-LD the page emits from the same LISTING_FAQ array).
 * Body text is 17/28 (`type-article`), the first question starts open.
 */
export function ListingEditorial() {
  return (
    <div className="container-reading">
      {EDITORIAL_SECTIONS.map((section, index) => (
        <div key={section.id} className={index === 0 ? undefined : "mt-10"}>
          <h2 id={section.id}>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="type-article mt-3 text-ink-700">
              {paragraph}
            </p>
          ))}
        </div>
      ))}

      <h2 id="najczestsze-pytania" className="mt-12">
        Najczęstsze pytania o promocje bankowe
      </h2>
      <div className="mt-4 border-t border-line">
        {LISTING_FAQ.map((item, index) => (
          <details key={item.question} open={index === 0} className="accordion group border-b border-line">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-ui font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <ChevronDown size={20} aria-hidden="true" className="acc-chevron shrink-0 text-ink-500" />
            </summary>
            <div className="pb-6">
              <p className="type-article text-ink-700">{item.answer}</p>
              {item.link ? (
                <p className="mt-2 text-small">
                  <Link href={item.link.href} className="link-inline font-medium">
                    {item.link.label}
                  </Link>
                </p>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
