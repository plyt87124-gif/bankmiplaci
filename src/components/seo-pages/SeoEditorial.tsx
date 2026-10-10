import Link from "next/link";
import { FaqAccordion } from "@/components/FaqAccordion";
import type { EditorialSection, RelatedLink, SeoFaqItem } from "./shared";

/**
 * The text part under the list of a landing page, in the 44 rem reading
 * column: editorial sections (H2 + paragraphs 17/28), the FAQ (native
 * <details>, every answer in the HTML; the page sends the SAME array to the
 * FAQPage JSON-LD) and the "Zobacz także" links. Server component, no JS.
 * Every part is optional, so a page can use only what it has.
 */
export function SeoEditorial({
  sections = [],
  faq = [],
  faqHeading = "Najczęstsze pytania",
  related = [],
  relatedHeading = "Zobacz także",
  idPrefix = ""
}: {
  sections?: readonly EditorialSection[];
  faq?: readonly SeoFaqItem[];
  faqHeading?: string;
  related?: readonly RelatedLink[];
  relatedHeading?: string;
  /** Prefix for the heading ids when a page shows two blocks. */
  idPrefix?: string;
}) {
  return (
    <div className="container-reading">
      {sections.map((section, index) => (
        <section key={section.id} aria-labelledby={`${idPrefix}${section.id}`} className={index === 0 ? undefined : "mt-10"}>
          <h2 id={`${idPrefix}${section.id}`}>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="type-article mt-3 text-ink-700">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {faq.length > 0 ? (
        <section aria-labelledby={`${idPrefix}najczestsze-pytania`} className={sections.length > 0 ? "mt-12" : undefined}>
          <h2 id={`${idPrefix}najczestsze-pytania`}>{faqHeading}</h2>
          <div className="mt-4">
            <FaqAccordion items={faq} />
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <nav aria-labelledby={`${idPrefix}zobacz-takze`} className={sections.length > 0 || faq.length > 0 ? "mt-12" : undefined}>
          <h2 id={`${idPrefix}zobacz-takze`}>{relatedHeading}</h2>
          <ul role="list" className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {related.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="link-inline inline-flex min-h-11 items-center font-medium">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
