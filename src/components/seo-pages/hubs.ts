/**
 * Pure model of the two account hubs, /konta-osobiste-z-premia and
 * /konta-firmowe-z-premia (docs/redesign-v2/03-content-and-seo-plan.md, section E):
 * which offers belong to a hub, the lead, the editorial block and the FAQ.
 * No React, no database - the page, the component and the tests share it.
 *
 * Which offers: only BUSINESS accounts are "firmowe"; PERSONAL, SAVINGS, YOUNG
 * and JOINT are "osobiste" - the one definition in src/lib/accountTypes.ts,
 * shared with the /promocje tabs and their counters, the home segments,
 * /porownaj and the quiz (the sitemap's lastmod of the personal hub applies the
 * same rule), so the number of a hub is the number of its tab. The list keeps
 * the order it was given: the hub always shows the default "Polecane" order,
 * so the disclosure strip above it is the "recommended" one. Filtering a list that is already in that order
 * keeps the order right: an offer's "Polecane" score only depends on the
 * offers of its own account type.
 */
import { segmentOf } from "@/lib/accountTypes";
import { pluralizePl } from "@/lib/format";
import type { HubKind } from "@/lib/seo";
import {
  COMMON_RELATED_LINKS,
  countWords,
  type EditorialSection,
  type RelatedLink,
  type SeoFaqItem
} from "./shared";

export type { HubKind };

/** Offers shown on a hub page; the rest is one click away on /promocje. */
export const HUB_CARD_LIMIT = 24;

export interface HubConfig {
  kind: HubKind;
  path: string;
  /** Name in breadcrumbs and in links ("Konta osobiste z premią"). */
  label: string;
  /** The other hub (cross-link). */
  other: HubKind;
}

export const HUBS: Record<HubKind, HubConfig> = {
  personal: { kind: "personal", path: "/konta-osobiste-z-premia", label: "Konta osobiste z premią", other: "business" },
  business: { kind: "business", path: "/konta-firmowe-z-premia", label: "Konta firmowe z premią", other: "personal" }
};

/** Which hub an account type (Prisma AccountType) belongs to. */
export function hubKindOf(accountType: string): HubKind {
  return segmentOf(accountType) === "BUSINESS" ? "business" : "personal";
}

/** The offers of one hub, in the order given. */
export function selectHubCards<T extends { accountType: string }>(cards: readonly T[], kind: HubKind): T[] {
  return cards.filter((card) => hubKindOf(card.accountType) === kind);
}

/** Newest verification date among the cards; null when there is no usable one. */
export function latestVerification(cards: readonly { lastVerifiedAt?: Date | string | null }[]): Date | null {
  let best: Date | null = null;
  for (const card of cards) {
    if (card.lastVerifiedAt == null) continue;
    const date = card.lastVerifiedAt instanceof Date ? card.lastVerifiedAt : new Date(card.lastVerifiedAt);
    if (Number.isNaN(date.getTime())) continue;
    if (!best || date.getTime() > best.getTime()) best = date;
  }
  return best;
}

const OFFERS = (n: number) => pluralizePl(n, "ofertę", "oferty", "ofert");

/** One-sentence lead under the H1. `count` = offers of this hub (all of them, not only the visible ones). */
export function hubLead(kind: HubKind, count: number): string {
  if (count <= 0) {
    return kind === "personal"
      ? "Obecnie nie mamy aktualnych promocji na konta osobiste. Zobacz, co jeszcze możesz sprawdzić."
      : "Obecnie nie mamy aktualnych promocji na konta firmowe. Zobacz, co jeszcze możesz sprawdzić.";
  }
  const what = kind === "personal" ? "konta dla osób fizycznych" : "konta dla firm i jednoosobowych działalności";
  return `Zestawiamy ${count} ${OFFERS(count)} na ${what}: kwota premii, trudność, koszt konta i termin zapisów. Warunki krok po kroku znajdziesz na stronie każdej oferty.`;
}

/** Heading of the list. */
export function hubListHeading(count: number): string {
  return `Aktualne promocje (${count})`;
}

/* ------------------------------------------------------------------ */
/* Editorial text                                                      */
/* ------------------------------------------------------------------ */

const PERSONAL_SECTIONS: readonly EditorialSection[] = [
  {
    id: "jak-wybrac",
    heading: "Jak wybrać konto osobiste z premią",
    paragraphs: [
      "Wysokość premii to dopiero początek. Zanim wybierzesz ofertę, sprawdź cztery rzeczy: ile trzeba zrobić, żeby dostać nagrodę, ile kosztuje konto, do kiedy trwają zapisy i czy w ogóle możesz z promocji skorzystać. Na kartach ofert pokazujemy obok siebie kwotę, wskaźnik trudności, opłatę za konto, termin i datę ostatniej weryfikacji. Kto może skorzystać i jakie dokładnie kroki trzeba wykonać, opisujemy na stronie każdej oferty."
    ]
  },
  {
    id: "warunki",
    heading: "Czego szukać w warunkach promocji",
    paragraphs: [
      "Warunki różnią się między ofertami, ale kilka elementów powtarza się najczęściej: wpływy na konto, płatności kartą, logowanie do aplikacji mobilnej albo założenie dodatkowego produktu. Zwróć uwagę, ile razy albo na jaką kwotę trzeba wykonać daną czynność, w jakim okresie i od kiedy ten okres się liczy. Sprawdź też, kiedy bank wypłaca premię i czy konto trzeba utrzymać przez określony czas. Przy ofertach, które mają ściągę, kroki możesz po zalogowaniu zapisać i zaznaczać w miarę wykonywania."
    ]
  },
  {
    id: "karencja",
    heading: "Karencja i status nowego klienta",
    paragraphs: [
      "Wiele promocji jest przeznaczonych dla osób, które nie korzystały dotąd z konta w danym banku. Jeśli konto w danym banku zostało zamknięte niedawno, regulamin może wymagać przerwy, czyli karencji. Jej długość podaje bank, a my zapisujemy ją w ofercie, gdy ją znamy. Po zalogowaniu możesz podać w swoim koncie datę zamknięcia rachunku w danym banku, a przy ofertach z karencją pokażemy, czy możesz już skorzystać."
    ]
  },
  {
    id: "oplaty",
    heading: "Opłaty za konto i kartę",
    paragraphs: [
      "Konto z premią nie zawsze jest bezpłatne. Opłata za prowadzenie konta lub kartę potrafi zniknąć dopiero po spełnieniu warunku, na przykład po wpływie na konto albo płatnościach kartą, a po zakończeniu promocji może wrócić. Przy każdej ofercie pokazujemy opłatę za konto albo „Brak danych”, jeśli jej nie zweryfikowaliśmy – brak informacji nie oznacza zera. Aktualną tabelę opłat sprawdź zawsze w banku."
    ]
  },
  {
    id: "kolejnosc",
    heading: "Jak ułożona jest ta lista",
    paragraphs: [
      "Lista jest ułożona w kolejności „Polecane”. Jeśli wolisz inny porządek, na stronie wszystkich promocji możesz posortować oferty według oceny serwisu, wysokości premii, trudności albo terminu zapisów."
    ]
  }
];

const BUSINESS_SECTIONS: readonly EditorialSection[] = [
  {
    id: "dla-kogo",
    heading: "Dla kogo są konta firmowe z premią",
    paragraphs: [
      "Promocje na konta firmowe są skierowane do przedsiębiorców: osób prowadzących jednoosobową działalność gospodarczą oraz firm działających w innej formie. Regulamin może ograniczać krąg uprawnionych, na przykład do firm, które nie miały dotąd rachunku w danym banku, albo ze względu na formę prawną czy datę rozpoczęcia działalności. Na stronie oferty opisujemy te zasady, gdy je znamy. Zanim złożysz wniosek, sprawdź, czy spełniasz je wszystkie."
    ]
  },
  {
    id: "warunki",
    heading: "Typowe warunki: wpływy, płatności kartą, terminal",
    paragraphs: [
      "W ofertach dla firm najczęściej pojawiają się wymagania związane z codzienną działalnością: wpływy na rachunek, płatności kartą firmową, a czasem rozliczenia przez terminal płatniczy albo korzystanie z bankowości internetowej. Sprawdź, czy bank wymaga określonej kwoty, liczby transakcji, czy jednego i drugiego, w jakim okresie i czy liczą się wyłącznie nowe wpływy. Zwróć uwagę, czy do premii potrzebny jest dodatkowy produkt, na przykład terminal, i ile on kosztuje."
    ]
  },
  {
    id: "koszty",
    heading: "Koszty prowadzenia konta firmowego",
    paragraphs: [
      "Tabela opłat konta firmowego może obejmować więcej pozycji niż w koncie osobistym: prowadzenie rachunku, kartę, przelewy, wpłaty i wypłaty gotówki, a przy terminalu także prowizje od transakcji. Na kartach pokazujemy opłatę za konto albo „Brak danych”, gdy jej nie zweryfikowaliśmy. Premia nie powinna być jedynym kryterium: policz, ile konto będzie kosztować po zakończeniu promocji, według aktualnej tabeli opłat banku."
    ]
  },
  {
    id: "termin",
    heading: "Co oznacza termin zapisów",
    paragraphs: [
      "Sprawdź w regulaminie, co dokładnie oznacza termin zapisów: dzień złożenia wniosku, podpisania umowy czy otwarcia rachunku. Przy ofertach, które kończą się niedługo, zostaw sobie zapas czasu na formalności. Listę promocji z najbliższymi terminami znajdziesz na stronie z promocjami kończącymi się wkrótce."
    ]
  },
  {
    id: "kolejnosc",
    heading: "Jak ułożone są oferty dla firm",
    paragraphs: [
      "Oferty dla firm są ułożone w kolejności „Polecane”. Na stronie wszystkich promocji możesz przełączyć widok na konta firmowe i posortować oferty inaczej, na przykład według oceny serwisu albo wysokości premii."
    ]
  }
];

/** The editorial block of a hub (headings excluded: 200-450 words, unique per hub). */
export const HUB_SECTIONS: Record<HubKind, readonly EditorialSection[]> = {
  personal: PERSONAL_SECTIONS,
  business: BUSINESS_SECTIONS
};

export function hubEditorialWordCount(kind: HubKind): number {
  return countWords(HUB_SECTIONS[kind]);
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

const PERSONAL_FAQ: readonly SeoFaqItem[] = [
  {
    question: "Czy każdy może skorzystać z promocji na konto osobiste?",
    answer:
      "Nie zawsze. O tym, kto może skorzystać, decyduje regulamin promocji: bank może wymagać statusu nowego klienta, odpowiedniego wieku albo założenia konkretnego typu konta. Zanim założysz konto, przeczytaj warunki na stronie oferty i w regulaminie banku – ostateczne zasady zawsze określa bank."
  },
  {
    question: "Ile trzeba zrobić, żeby dostać premię?",
    answer:
      "To zależy od promocji. Zwykle trzeba otworzyć konto w terminie i w określonym czasie wykonać kilka czynności, na przykład płatności kartą albo regularne wpływy. Skalę wysiłku pokazujemy czterostopniowym wskaźnikiem trudności, a dokładne kroki znajdziesz na stronie każdej oferty."
  },
  {
    question: "Czy konto z premią jest bezpłatne?",
    answer:
      "Nie zawsze. W części ofert opłata znika dopiero po spełnieniu warunku, a po zakończeniu promocji może wrócić. Przy każdej ofercie pokazujemy opłatę za konto albo „Brak danych”, gdy jej nie zweryfikowaliśmy – wtedy sprawdź tabelę opłat banku."
  },
  {
    question: "Czy mogę mieć kilka kont z premią naraz?",
    answer:
      "To zależy od regulaminów poszczególnych promocji. Każdy bank określa, kto jest dla niego nowym klientem i czy promocje można łączyć. Nie oceniamy, jak liczba kont wpływa na zdolność kredytową – w tej sprawie zapytaj bank lub doradcę."
  },
  {
    question: "Skąd wiadomo, że promocja jest aktualna?",
    answer:
      "Przy każdej ofercie pokazujemy termin zapisów i datę ostatniej weryfikacji, a tam, gdzie znamy źródło, także link do regulaminu banku. Bank może jednak zakończyć lub zmienić promocję wcześniej, dlatego przed założeniem konta sprawdź warunki w regulaminie. Zasady weryfikacji opisujemy w metodologii.",
    link: { label: "Jak liczymy ocenę i weryfikujemy dane", href: "/metodologia" }
  }
];

const BUSINESS_FAQ: readonly SeoFaqItem[] = [
  {
    question: "Kto może skorzystać z promocji na konto firmowe?",
    answer:
      "Decyduje regulamin promocji. Bank może ograniczyć ofertę do nowych klientów, do wybranych form prawnych albo do firm, które dopiero rozpoczynają działalność. Kto może skorzystać, opisujemy na stronie oferty, gdy mamy te informacje, ale ostateczne zasady zawsze określa bank."
  },
  {
    question: "Jakie warunki są typowe w promocjach na konta firmowe?",
    answer:
      "Najczęściej są to wpływy na rachunek, płatności kartą firmową, korzystanie z bankowości internetowej, a czasem terminal płatniczy. Zakres wymagań zależy od oferty, dlatego sprawdź kwoty, liczbę transakcji i okres, w którym trzeba je wykonać."
  },
  {
    question: "Czy konto firmowe z premią jest bezpłatne?",
    answer:
      "Nie zawsze. Opłata za prowadzenie konta lub kartę może znikać dopiero po spełnieniu warunku, a w tabeli opłat są też inne pozycje, na przykład przelewy czy prowizje od terminala. Przy każdej ofercie pokazujemy opłatę za konto albo „Brak danych”, gdy jej nie zweryfikowaliśmy."
  },
  {
    question: "Czy premia dla firmy podlega opodatkowaniu?",
    answer:
      "Może podlegać. Sposób rozliczenia zależy od formy działalności i rodzaju nagrody, a informacje o nim znajdziesz w regulaminie promocji. W razie wątpliwości skonsultuj się z księgowym lub doradcą podatkowym. To nie jest porada podatkowa."
  },
  {
    question: "Czy trzeba prowadzić firmę, żeby założyć konto firmowe?",
    answer:
      "Konto firmowe jest przeznaczone dla działalności gospodarczej, dlatego bank poprosi o dane firmy i dokumenty potwierdzające jej prowadzenie. Jakie dokładnie, podaje bank w procesie otwarcia rachunku."
  }
];

export const HUB_FAQ: Record<HubKind, readonly SeoFaqItem[]> = {
  personal: PERSONAL_FAQ,
  business: BUSINESS_FAQ
};

/** "Zobacz także" links of a hub: the tools, the trust pages, the other hub, banks, ending soon, the full list. */
export function hubRelatedLinks(kind: HubKind): RelatedLink[] {
  const other = HUBS[HUBS[kind].other];
  return [
    ...COMMON_RELATED_LINKS,
    { href: other.path, label: other.label },
    { href: "/banki", label: "Banki z promocjami" },
    { href: "/promocje/konczace-sie", label: "Promocje kończące się wkrótce" },
    { href: "/promocje", label: "Wszystkie aktualne promocje" }
  ];
}
