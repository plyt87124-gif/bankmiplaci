/**
 * Pure model of /promocje/konczace-sie (docs/redesign-v2/03-content-and-seo-plan.md,
 * section E): grouping of the offers by how many days are left, the
 * "zostało N dni" caption, the lead, the editorial text and the FAQ.
 *
 * Days are counted by format.ts#daysUntil - the SAME function the deadline
 * badge of a card (lib/freshness.ts) uses: whole calendar days on Poland's
 * clock to the offer's last sign-up day, 0 = the last day is today, the last
 * day itself is still open. So the caption and the badge on one card can never
 * disagree. Nothing is invented: an offer without a usable end date is left out.
 */
import { daysUntil, formatDatePL, pluralizePl } from "@/lib/format";
import { COMMON_RELATED_LINKS, countWords, type EditorialSection, type RelatedLink, type SeoFaqItem } from "./shared";

/** The farthest deadline the page shows (getEndingSoon(30)). */
export const ENDING_SOON_MAX_DAYS = 30;

export interface EndingSoonGroupDef {
  id: "do-7" | "8-14" | "15-30";
  /** Inclusive range of days left. */
  from: number;
  to: number;
  /** H2 of the group. */
  heading: string;
}

/** Thresholds of the plan: 7 / 14 / 30 days. */
export const ENDING_SOON_GROUPS: readonly EndingSoonGroupDef[] = [
  { id: "do-7", from: 0, to: 7, heading: "Zostało do 7 dni" },
  { id: "8-14", from: 8, to: 14, heading: "Zostało 8–14 dni" },
  { id: "15-30", from: 15, to: ENDING_SOON_MAX_DAYS, heading: "Zostało 15–30 dni" }
];

export interface EndingSoonGroup<T> extends EndingSoonGroupDef {
  cards: T[];
}

/**
 * Splits the offers into the groups; the order inside a group is the order
 * given (the service returns the soonest deadline first). Groups with no offer
 * are NOT returned, so the page never prints an empty heading. Offers that are
 * already over, farther than 30 days, or without a usable date are dropped.
 */
export function groupEndingSoon<T extends { endDate: Date | string }>(
  cards: readonly T[],
  now: Date
): EndingSoonGroup<T>[] {
  return ENDING_SOON_GROUPS.map((def) => ({
    ...def,
    cards: cards.filter((card) => {
      const days = daysUntil(card.endDate, now);
      return days !== null && days >= def.from && days <= def.to;
    })
  })).filter((group) => group.cards.length > 0);
}

/** "Zostało 17 dni (do 27.10.2026)" / "Został 1 dzień (do ...)" / "Ostatni dzień zapisów: dziś (...)"; null without a usable date. */
export function deadlineCaption(endDate: Date | string | null | undefined, now: Date): string | null {
  const days = daysUntil(endDate, now);
  if (days === null) return null;
  const date = formatDatePL(endDate as Date | string, "numeric");
  if (days < 0) return `Zakończona ${date}`;
  if (days === 0) return `Ostatni dzień zapisów: dziś (${date})`;
  const verb = pluralizePl(days, "Został", "Zostały", "Zostało");
  const noun = pluralizePl(days, "dzień", "dni", "dni");
  return `${verb} ${days} ${noun} (do ${date})`;
}

const PROMOTIONS = (n: number) => pluralizePl(n, "promocję", "promocje", "promocji");

/** One-sentence lead; `total` = offers in all groups. */
export function endingSoonLead(total: number): string {
  if (total <= 0) {
    return `Obecnie żadna z aktualnych promocji nie kończy się w ciągu ${ENDING_SOON_MAX_DAYS} dni.`;
  }
  return `W ciągu ${ENDING_SOON_MAX_DAYS} dni kończy się termin zapisów na ${total} ${PROMOTIONS(total)}. Poniżej są pogrupowane według liczby pozostałych dni, od najbliższego terminu.`;
}

/** The note the plan asks for, shown under the lead of a non-empty list. */
export const ENDING_SOON_EARLY_END_NOTE = "Bank może zakończyć promocję wcześniej, gdy wyczerpie się pula.";

export const ENDING_SOON_SECTIONS: readonly EditorialSection[] = [
  {
    id: "jak-czytac-terminy",
    heading: "Jak czytać terminy promocji",
    paragraphs: [
      "Termin na tej stronie to ostatni dzień, w którym można skorzystać z promocji, czyli otworzyć konto albo zapisać się do oferty. Liczbę pozostałych dni liczymy w dniach kalendarzowych według czasu polskiego, a w ostatnim dniu zapisów oferta jest jeszcze dostępna.",
      "Przy krótkim terminie najpierw sprawdź, czy kwalifikujesz się do promocji i czy zdążysz wykonać wszystkie kroki, a dopiero potem porównuj kwoty.",
      "Termin zapisów nie mówi, ile czasu masz na spełnienie warunków. To osobny okres, który określa regulamin i który opisujemy w warunkach oferty. Policz go jeszcze przed założeniem konta.",
      "Zakończone promocje znikają z listy aktualnych, ale ich strony zostają z informacją o zakończeniu, a oferty każdego banku, także te zakończone, znajdziesz na stronie banku."
    ]
  }
];

export const ENDING_SOON_FAQ: readonly SeoFaqItem[] = [
  {
    question: "Co znaczy „zostało N dni”?",
    answer:
      "To liczba dni kalendarzowych, według czasu polskiego, od dziś do ostatniego dnia zapisów podanego w ofercie. W ostatnim dniu zapisów można jeszcze skorzystać z promocji."
  },
  {
    question: "Czy bank może zakończyć promocję przed terminem?",
    answer:
      "Regulamin może przewidywać wcześniejsze zakończenie, na przykład gdy wyczerpie się pula nagród. Dlatego sprawdź w regulaminie banku, czy promocja ma limit miejsc lub środków."
  },
  {
    question: "Co się dzieje z promocją po terminie?",
    answer:
      "Przestaje być aktualna i znika z listy ofert. Jej strona zostaje w serwisie z informacją, że promocja się zakończyła, a jeśli bank ma inne aktualne oferty, pokazujemy je na stronie zakończonej promocji w osobnym bloku."
  }
];

export function endingSoonWordCount(): number {
  return countWords(ENDING_SOON_SECTIONS);
}

export const ENDING_SOON_RELATED: readonly RelatedLink[] = [
  { href: "/promocje", label: "Wszystkie aktualne promocje" },
  { href: "/banki", label: "Banki z promocjami" },
  { href: "/konta-osobiste-z-premia", label: "Konta osobiste z premią" },
  { href: "/konta-firmowe-z-premia", label: "Konta firmowe z premią" },
  ...COMMON_RELATED_LINKS
];
