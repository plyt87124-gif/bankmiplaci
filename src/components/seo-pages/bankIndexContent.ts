/**
 * Editorial text of /banki: how to use the list, what it is not, and a short
 * FAQ. Plain data (so the page, the FAQPage JSON-LD and the tests read the
 * same array). General statements about the service only - no bank names, no
 * counts, no dates.
 */
import { COMMON_RELATED_LINKS, type EditorialSection, type RelatedLink, type SeoFaqItem } from "./shared";

export const BANK_INDEX_SECTIONS: readonly EditorialSection[] = [
  {
    id: "jak-korzystac",
    heading: "Jak korzystać z listy banków",
    paragraphs: [
      "Lista zawiera banki, których promocje analizujemy. Przy każdym banku widzisz, ile aktualnych promocji mamy teraz w serwisie. Na stronie banku znajdziesz jego aktualne oferty na konta osobiste i firmowe, a także zakończone promocje, żeby było widać, jak wyglądały wcześniejsze edycje. Strona banku zostaje w serwisie także wtedy, gdy żadna z jego promocji nie jest aktualna. Zanim założysz konto, przeczytaj warunki promocji w regulaminie banku – link do niego podajemy na stronie oferty, gdy go znamy."
    ]
  },
  {
    id: "zakres",
    heading: "Czego tu nie ma",
    paragraphs: [
      "Nie obejmujemy całego rynku. Pokazujemy banki, których promocje przeanalizowaliśmy, więc brak banku na liście nie oznacza, że nie ma on promocji. To także nie jest ranking banków: oceniamy konkretne promocje, a nie sam bank."
    ]
  }
];

export const BANK_INDEX_FAQ: readonly SeoFaqItem[] = [
  {
    question: "Dlaczego nie ma na liście mojego banku?",
    answer:
      "Nie obejmujemy całego rynku. Na liście są banki, których promocje przeanalizowaliśmy. Jeśli brakuje banku, którego promocji szukasz, możesz dać nam znać w formularzu kontaktowym.",
    link: { label: "Kontakt", href: "/kontakt" }
  },
  {
    question: "Co znaczy „Brak aktualnych promocji”?",
    answer:
      "Bank nie ma w serwisie żadnej promocji, z której można teraz skorzystać. Strona banku pokazuje wtedy zakończone promocje. Warunki i termin nowej oferty sprawdź w banku."
  },
  {
    question: "Czy lista banków jest rankingiem?",
    answer:
      "Nie. Banki są ułożone alfabetycznie. Oceniamy konkretne promocje (ocena serwisu), a nie banki, a sposób liczenia opisujemy w metodologii.",
    link: { label: "Jak liczymy ocenę serwisu", href: "/metodologia" }
  }
];

export const BANK_INDEX_RELATED: readonly RelatedLink[] = [
  ...COMMON_RELATED_LINKS,
  { href: "/konta-osobiste-z-premia", label: "Konta osobiste z premią" },
  { href: "/konta-firmowe-z-premia", label: "Konta firmowe z premią" },
  { href: "/promocje/konczace-sie", label: "Promocje kończące się wkrótce" },
  { href: "/promocje", label: "Wszystkie aktualne promocje" }
];
