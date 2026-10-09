import type { Metadata } from "next";
import { FaqAccordion } from "@/components/FaqAccordion";
import { JsonLd } from "@/components/JsonLd";
import { faqLd, staticPageMetadata } from "@/lib/seo";
import { TextPage, type TocEntry } from "../jak-to-dziala/TextPage";
import { FAQ_GROUPS, FAQ_ITEMS } from "./faqItems";

export const metadata: Metadata = staticPageMetadata("faq");

const TOC: TocEntry[] = FAQ_GROUPS.map((group) => ({ id: group.id, label: group.title }));

export default function FaqPage() {
  return (
    <TextPage
      path="/faq"
      breadcrumbLabel="FAQ"
      title="Najczęstsze pytania o promocje bankowe"
      lead={
        <p>
          Odpowiedzi mają charakter ogólnoinformacyjny i nie stanowią porady prawnej, podatkowej ani finansowej.
          Ostateczne warunki promocji zawsze określa regulamin banku.
        </p>
      }
      toc={TOC}
    >
      {FAQ_GROUPS.map((group, index) => (
        <section key={group.id} aria-labelledby={group.id}>
          <h2 id={group.id} className={index === 0 ? "!mt-0" : undefined}>
            {group.title}
          </h2>
          <div className="mt-4">
            <FaqAccordion items={group.items} openFirst={index === 0} />
          </div>
        </section>
      ))}
      <JsonLd data={faqLd(FAQ_ITEMS)} />
    </TextPage>
  );
}
