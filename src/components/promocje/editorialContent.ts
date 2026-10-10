/**
 * Editorial text of /promocje (below the list). Plain data so it can be
 * counted and checked by a test and so the FAQ shown on the page and the
 * FAQPage JSON-LD come from the SAME array.
 *
 * Writing rules (docs/redesign-v2/03-content-and-seo-plan.md, A and F):
 * general facts only - how a bonus account works, what to watch out for. No
 * amounts, dates or counts (they live in the database and on the cards), no
 * promises, no claims about specific banks. Wording about the ranking and the
 * rating mirrors lib/disclosureCopy.ts and services/ratings.ts.
 */
import { DISCLOSURE_LINKS } from "@/lib/disclosureCopy";
import { KARENCJA_DEFINITION } from "@/lib/glossary";
import { ratingExplainerHref } from "@/components/promocje/cardCopy";

export interface EditorialSection {
  id: string;
  heading: string;
  paragraphs: readonly string[];
}

export const EDITORIAL_SECTIONS: readonly EditorialSection[] = [
  {
    id: "jak-dziala-konto-z-premia",
    heading: "Jak działa konto z premią?",
    paragraphs: [
      "Premia za założenie konta to nagroda od banku dla klientów, którzy spełnią warunki promocji. Najczęściej trzeba otworzyć konto w wyznaczonym terminie i wykonać kilka czynności, na przykład płacić kartą, utrzymywać na koncie wpływy albo korzystać z aplikacji mobilnej. Bank wypłaca nagrodę dopiero po sprawdzeniu, czy wszystkie warunki zostały spełnione, a zasady i termin wypłaty opisuje regulamin promocji."
    ]
  },
  {
    id: "dla-kogo-sa-promocje",
    heading: "Dla kogo są promocje bankowe?",
    paragraphs: [
      "Promocje są zwykle skierowane do osób, które zakładają nowe konto i nie mają go jeszcze w danym banku. Banki często wymagają też, aby przez pewien czas przed założeniem konta nie być jego klientem. Ten okres nazywa się karencją, a jego długość podaje regulamin. Osobne promocje dotyczą kont firmowych, a niektóre są przeznaczone dla wybranych grup, na przykład młodszych klientów. Dlatego przy każdej ofercie sprawdź, kto może z niej skorzystać."
    ]
  },
  {
    id: "na-co-uwazac",
    heading: "Na co uważać przed założeniem konta",
    paragraphs: [
      "Sprawdź termin zapisów i wszystkie warunki jeszcze przed założeniem konta, bo bank może zakończyć promocję wcześniej, na przykład gdy wyczerpie się pula nagród. Zwróć uwagę na opłaty: część kont jest bezpłatna bez żadnych warunków, a w innych opłata znika dopiero po spełnieniu wymagań, na przykład po wpływie na konto lub płatnościach kartą. Jeśli nie zweryfikowaliśmy opłaty, piszemy „Brak danych”, a nie zero. Pamiętaj też, że premia może podlegać opodatkowaniu, a niektóre promocje mogą wymagać otwarcia konta przez link lub kod promocyjny, dlatego sprawdź to w regulaminie banku. Ostateczne warunki zawsze określa bank."
    ]
  },
  {
    id: "jak-czytac-ocene-i-trudnosc",
    heading: "Jak czytać naszą ocenę i trudność",
    paragraphs: [
      "Ocena serwisu to nasza ocena samej promocji, a nie banku. Porównujemy w niej m.in. wysokość premii, trudność jej zdobycia i czas potrzebny na spełnienie warunków z innymi aktualnymi ofertami. Prowizja, którą możemy otrzymać od banku, nie wpływa na ocenę. Trudność pokazujemy czterostopniowym wskaźnikiem, od „Bardzo łatwej” do „Trudnej”: im więcej pól jest wypełnionych, tym więcej trzeba zrobić, aby dostać premię. Pokazujemy promocje, które przeanalizowaliśmy, a nie cały rynek, i nie jest to doradztwo finansowe."
    ]
  }
];

export interface FaqEntry {
  question: string;
  /** Plain text: shown on the page AND sent as the FAQPage answer. */
  answer: string;
  /** Optional link shown after the answer (not part of the structured data). */
  link?: { label: string; href: string };
}

export const LISTING_FAQ: readonly FaqEntry[] = [
  {
    question: "Czy promocje bankowe są dla każdego?",
    answer:
      "Nie zawsze. O tym, kto może skorzystać, decyduje regulamin promocji: bank może wymagać na przykład statusu nowego klienta, odpowiedniego wieku albo założenia konkretnego typu konta. Zanim założysz konto, sprawdź warunki na stronie oferty i w regulaminie banku – ostateczne zasady zawsze określa bank."
  },
  {
    question: "Co to jest karencja?",
    answer:
      `${KARENCJA_DEFINITION} Dopiero po jej upływie możesz ponownie skorzystać z promocji dla nowych klientów.`
  },
  {
    question: "Kiedy bank wypłaca premię?",
    answer:
      "Termin zależy od promocji. Zwykle bank wypłaca nagrodę po spełnieniu wszystkich warunków, czasem dopiero po zakończeniu okresu promocji. Termin wypłaty określa regulamin promocji."
  },
  {
    question: "Czy muszę otworzyć konto przez link z waszej strony?",
    answer:
      "To zależy od promocji. Niektóre banki wymagają otwarcia konta przez konkretny link lub kod promocyjny, inne nie. Sprawdź w regulaminie banku i w warunkach oferty, czy konto trzeba otworzyć przez link lub kod, zanim je założysz. Linki do banków na naszej stronie mogą być linkami partnerskimi – opisujemy to w „Jak zarabiamy”.",
    link: { label: "Jak zarabiamy", href: DISCLOSURE_LINKS.howWeEarn }
  },
  {
    question: "Czy kolejność ofert zależy od prowizji?",
    answer:
      "Tak, ale tylko w sortowaniu „Polecane”, które jest ustawione domyślnie. Kolejność w nim zależy od oceny serwisu i od wynagrodzenia partnerskiego od banków, więc oferta o niższej ocenie może znaleźć się wyżej. Ocena serwisu jest liczona bez wynagrodzenia, a pozostałe sortowania, czyli „Najlepsza ocena”, „Najwyższa premia”, „Najłatwiejsze”, „Najnowsze” i „Kończące się wkrótce”, od niego nie zależą.",
    link: { label: "Jak zarabiamy", href: DISCLOSURE_LINKS.howWeEarnRecommended }
  },
  {
    question: "Jak liczymy ocenę serwisu?",
    answer:
      "To nasza ocena samej promocji, a nie banku. Porównujemy m.in. wysokość premii, trudność jej zdobycia i czas potrzebny na spełnienie warunków z innymi aktualnymi ofertami. Prowizja nie jest składnikiem oceny. Ocena serwisu nie jest poradą finansową.",
    link: { label: "Jak liczymy ocenę", href: ratingExplainerHref() }
  },
  {
    question: "Czy za konto trzeba płacić?",
    answer:
      "Nie zawsze. Część kont jest bezpłatna bez warunków, a w innych opłata znika dopiero po spełnieniu wymagań, na przykład po wpływie na konto lub płatnościach kartą. Przy każdej ofercie pokazujemy opłatę za konto albo „Brak danych”, gdy jej nie zweryfikowaliśmy. W takim przypadku sprawdź tabelę opłat banku."
  },
  {
    question: "Czy premia bankowa podlega opodatkowaniu?",
    answer:
      "Może podlegać. Sposób rozliczenia zależy od rodzaju nagrody i Twojej sytuacji, a informacje o nim znajdziesz w regulaminie promocji. W razie wątpliwości skonsultuj się z doradcą podatkowym lub urzędem skarbowym. To nie jest porada podatkowa."
  }
];

/** Words in the editorial sections (headings excluded) - the plan asks for 200-400. */
export function editorialWordCount(sections: readonly EditorialSection[] = EDITORIAL_SECTIONS): number {
  return sections
    .flatMap((section) => section.paragraphs)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}
