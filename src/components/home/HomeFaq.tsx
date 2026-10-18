import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { FaqAccordion, type FaqAccordionItem } from "@/components/FaqAccordion";
import { cn } from "@/lib/cn";
import { homeFaqItems, liveHomeHubs, type HomeHub } from "./homeContent";

/**
 * FAQ shortcut (layout spec, HOME block 7): three questions taken from the /faq
 * source as native <details> (all answers are in the HTML), the link to the
 * whole FAQ, and links to the hubs - each only while its page is live, so the
 * home page never links to a 404. The FAQPage JSON-LD is built by HomeView
 * from the same items.
 */
export function HomeFaq({
  items = homeFaqItems(),
  hubs = liveHomeHubs()
}: {
  items?: readonly FaqAccordionItem[];
  hubs?: readonly HomeHub[];
}) {
  if (items.length === 0 && hubs.length === 0) return null;
  const hasHubs = hubs.length > 0;

  return (
    <section aria-labelledby={items.length > 0 ? "faq-title" : "przegladaj-title"} className="border-t border-line">
      <div
        className={cn(
          "container-page grid gap-10 py-12 md:py-[72px]",
          hasHubs && items.length > 0 && "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-16"
        )}
      >
        {items.length > 0 ? (
          <div>
            <h2 id="faq-title">Najczęstsze pytania</h2>
            <div className="mt-6">
              <FaqAccordion items={items} openFirst={false} />
            </div>
            <p className="mt-6">
              <Link href="/faq" className="link-inline inline-flex min-h-11 items-center gap-1.5 font-semibold">
                Wszystkie pytania i odpowiedzi
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>
          </div>
        ) : null}

        {hasHubs ? (
          <nav aria-labelledby="przegladaj-title">
            <h2 id="przegladaj-title" className="font-body text-h3 md:text-h3">
              Przeglądaj promocje
            </h2>
            <ul role="list" className="mt-4 border-t border-line">
              {hubs.map((hub) => (
                <li key={hub.href} className="border-b border-line">
                  <Link
                    href={hub.href}
                    className="group flex min-h-14 items-center justify-between gap-3 rounded-sm py-3 font-semibold text-ink-900 hover:text-action"
                  >
                    {hub.label}
                    <ChevronRight
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 text-ink-500 transition-transform duration-base ease-out group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
