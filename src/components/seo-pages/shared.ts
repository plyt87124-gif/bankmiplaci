/**
 * Small pure pieces shared by the SEO landing pages (account hubs, banks,
 * ending soon): the shapes of editorial text, FAQ and "see also" links, and the
 * one answer that must always agree with the disclosure strip.
 *
 * Writing rules for every text in this folder (docs/redesign-v2/03-content-and-seo-plan.md,
 * sections A and E): general facts about how bonus accounts work and what the
 * service does - NO amounts, bank names, dates or counts (they come from the
 * database and appear on the cards), no promises, no claims about a specific
 * bank. tests/seo-pages.test.tsx checks the "no digits / no bank names" rule.
 */
import { DISCLOSURE_LINKS, stripCopy } from "@/lib/disclosureCopy";

export interface SeoFaqItem {
  question: string;
  /** Plain text: shown on the page AND sent as the FAQPage answer. */
  answer: string;
  /** Optional link shown after the answer (not part of the structured data). */
  link?: { label: string; href: string };
}

export interface EditorialSection {
  id: string;
  heading: string;
  paragraphs: readonly string[];
}

export interface RelatedLink {
  href: string;
  label: string;
}

/** Words in the paragraphs (headings excluded). */
export function countWords(sections: readonly EditorialSection[]): number {
  return sections
    .flatMap((section) => section.paragraphs)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * FAQ "does the order of this list depend on the commission?" - for a list in
 * the default "Polecane" order. The statement about what the order depends on
 * is the disclosure strip's own sentence (lib/disclosureCopy.ts), so the page,
 * the FAQ and the FAQPage JSON-LD cannot say different things.
 */
export function recommendedOrderFaq(): SeoFaqItem {
  return {
    question: "Czy kolejność ofert na tej stronie zależy od prowizji?",
    answer:
      `Tak. Ta lista jest ułożona w sortowaniu „Polecane”. ${stripCopy("recommended").lead} ` +
      "Pozostałe sortowania na stronie wszystkich promocji, takie jak „Najlepsza ocena” czy „Najwyższa premia”, nie zależą od wynagrodzenia partnerskiego.",
    link: { label: "Jak zarabiamy", href: DISCLOSURE_LINKS.howWeEarnRecommended }
  };
}

/** Links that every landing page offers at the end ("Zobacz także"). */
export const COMMON_RELATED_LINKS: readonly RelatedLink[] = [
  { href: "/porownaj", label: "Porównaj promocje w tabeli" },
  { href: "/quiz", label: "Quiz: dopasuj promocję do siebie" },
  { href: "/metodologia", label: "Jak liczymy ocenę serwisu" },
  { href: "/jak-zarabiamy", label: "Jak zarabiamy" },
  { href: "/blog", label: "Poradniki o promocjach bankowych" }
];
