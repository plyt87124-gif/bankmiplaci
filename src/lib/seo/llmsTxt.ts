import { absoluteUrl, siteName } from "@/lib/seo/siteUrl";

/**
 * Content of /llms.txt: a short, honest map of the site for AI models
 * (convention: llmstxt.org). Static on purpose: it links only to stable pages,
 * never to a dated report, so it cannot go stale. It repeats what the site
 * already says about itself (how it earns, how it rates) and promises nothing
 * that /metodologia and /jak-zarabiamy do not.
 */

export interface LlmsLink {
  path: string;
  label: string;
  note: string;
}

export interface LlmsSection {
  title: string;
  links: LlmsLink[];
}

export const LLMS_SECTIONS: LlmsSection[] = [
  {
    title: "Najważniejsze strony",
    links: [
      { path: "/promocje", label: "Aktualne promocje bankowe", note: "lista ofert z premią, terminem, poziomem trudności i datą ostatniej weryfikacji" },
      { path: "/promocje/konczace-sie", label: "Promocje kończące się wkrótce", note: "oferty z najbliższym terminem wniosków" },
      { path: "/konta-osobiste-z-premia", label: "Konta osobiste z premią", note: "zestawienie ofert dla osób prywatnych" },
      { path: "/konta-firmowe-z-premia", label: "Konta firmowe z premią", note: "zestawienie ofert dla firm i działalności gospodarczych" },
      { path: "/porownaj", label: "Porównywarka promocji", note: "zestawienie wybranych ofert obok siebie" },
      { path: "/banki", label: "Banki", note: "strona każdego banku z jego aktywnymi promocjami" }
    ]
  },
  {
    title: "Jak oceniamy i jak zarabiamy",
    links: [
      { path: "/metodologia", label: "Metodologia", note: "jak liczymy ocenę serwisu i poziom trudności promocji" },
      { path: "/jak-zarabiamy", label: "Jak zarabiamy", note: "w jaki sposób serwis zarabia" },
      { path: "/o-nas", label: "O nas", note: "informacje o serwisie i zasady redakcyjne" },
      { path: "/faq", label: "Najczęstsze pytania", note: "odpowiedzi o promocjach, karencji i wypłacie premii" }
    ]
  },
  {
    title: "Artykuły",
    links: [
      { path: "/blog", label: "Wszystkie artykuły", note: "poradniki i opisy promocji" },
      { path: "/blog/jak-zarabiac-na-promocjach-bankowych", label: "Zarabianie na promocjach bankowych", note: "ile dają banki, jak działa premia i od czego zależy" },
      { path: "/blog/kategoria/promocje-bankowe", label: "Promocje bankowe: artykuły i raporty miesięczne", note: "m.in. miesięczny raport z danych serwisu" }
    ]
  }
];

export function buildLlmsTxt(): string {
  const name = siteName();
  const lines: string[] = [];
  lines.push(`# ${name}`);
  lines.push("");
  lines.push(
    "> Serwis porównujący promocje bankowe w Polsce: premie za założenie konta osobistego lub firmowego, warunki krok po kroku, terminy, poziom trudności i opłaty. Każda oferta ma datę ostatniej weryfikacji, a wiążący jest zawsze regulamin banku."
  );
  lines.push("");
  lines.push("Zasady, na których opieramy treści:");
  lines.push("");
  lines.push("- Kwoty premii to kwoty maksymalne („do”): pełna wartość wymaga spełnienia wszystkich warunków, często przez kilka miesięcy.");
  lines.push("- Nie jesteśmy bankiem ani doradcą. Możemy otrzymywać wynagrodzenie od banków lub partnerów, gdy użytkownik otworzy konto przez nasz link. Wynagrodzenie partnerskie jest jednym ze składników oceny serwisu i jest opisane w metodologii.");
  lines.push("- Dane o ofertach zawsze podajemy z datą stanu. Gdy oferta się kończy, strona to pokazuje.");
  lines.push("");
  for (const section of LLMS_SECTIONS) {
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const link of section.links) {
      lines.push(`- [${link.label}](${absoluteUrl(link.path)}): ${link.note}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
