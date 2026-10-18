import Link from "next/link";
import { ChevronDown } from "lucide-react";

export interface FaqAccordionItem {
  question: string;
  /** Plain text. The same string goes into the FAQPage JSON-LD (faqLd), so what the reader sees is what search engines get. */
  answer: string;
  /** Optional anchor id of the <details>, so a question can be linked to. */
  id?: string;
  /** Optional "Więcej" link shown under the answer (internal path). */
  link?: { href: string; label: string };
}

/**
 * FAQ as native <details>/<summary> (spec section 5, "Accordion"): a server
 * component with zero JavaScript, the whole answer text is always in the DOM
 * (search engines and print see it), the keyboard and screen readers get the
 * built-in disclosure semantics. Row: min-height 56 px, Inter 600 16/24,
 * chevron 20 px rotating 180 degrees (motion.css `.acc-chevron`), hairline
 * between rows, no box. The first row is open unless `openFirst={false}`.
 * The height animation comes from `details.accordion` in motion.css.
 */
export function FaqAccordion({
  items,
  openFirst = true
}: {
  items: readonly FaqAccordionItem[];
  openFirst?: boolean;
}) {
  return (
    <div className="border-t border-line">
      {items.map((item, i) => (
        <details key={item.id ?? item.question} id={item.id} className="accordion scroll-mt-20 border-b border-line" open={openFirst && i === 0}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-3 text-ui font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">{item.question}</span>
            <ChevronDown size={20} aria-hidden="true" className="acc-chevron shrink-0 text-ink-500" />
          </summary>
          <div className="max-w-[68ch] pb-6 text-article text-ink-700">
            <p>{item.answer}</p>
            {item.link ? (
              <p className="mt-3 text-small">
                <Link href={item.link.href} className="link-inline font-medium">
                  {item.link.label}
                </Link>
              </p>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}
