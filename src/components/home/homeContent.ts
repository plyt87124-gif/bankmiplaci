/**
 * Copy and fixed content of the home page that is not data from the database
 * (docs/redesign-v2/02-layout-spec.md HOME, 03-content-and-seo-plan.md,
 * 04-trust-and-disclosure-plan.md). Nothing here states a number, an amount
 * or a date: those come from the database or from constants of the code
 * (QUIZ_QUESTION_COUNT, ENDING_SOON_DAYS ...).
 *
 * The disclosure wording is NOT written here: it is imported from
 * lib/disclosureCopy.ts, the one source of those claims.
 */
import { FAQ_ITEMS } from "@/app/faq/faqItems";
import type { FaqAccordionItem } from "@/components/FaqAccordion";
import { RATING_COMMISSION_RULE, STRIP_RECOMMENDED } from "@/lib/disclosureCopy";
import { isRouteLive } from "@/lib/seo/routes";

export const HOME_H1 = "Promocje bankowe: znajdź konto z premią i sprawdź, co musisz zrobić";

export const HOME_LEAD =
  "Pokazujemy, ile możesz zyskać, ile to kosztuje i co trzeba zrobić – ze ściągą krok po kroku.";

/** Where "Ocena serwisu bez prowizji" leads: the section that explains the rating on /jak-zarabiamy. */
export const HOME_RATING_HREF = "/jak-zarabiamy#ocena";

/** Where the "Ile wysiłku wymaga promocja?" block explains how the level is set. */
export const HOME_DIFFICULTY_HREF = "/metodologia#skladniki";

export interface HomeTrustColumn {
  id: string;
  title: string;
  text: string;
  link: { href: string; label: string };
}

/**
 * "Dlaczego możesz nam ufać": three claims, each with a link to the page that
 * proves it. No fourth claim about the deposit guarantee (BFG) - it needs an
 * approved wording first (trust plan, section 9).
 */
export const HOME_TRUST_COLUMNS: readonly HomeTrustColumn[] = [
  {
    id: "dane",
    title: "Skąd bierzemy dane",
    text:
      "Z regulaminów promocji publikowanych przez banki i z ich tabel opłat. " +
      "Przy ofercie pokazujemy datę ostatniej weryfikacji i, gdy go mamy, link do źródła.",
    link: { href: "/metodologia#zrodla", label: "Źródła i weryfikacja" }
  },
  {
    id: "ocena",
    title: "Jak liczymy ocenę",
    text:
      "Ocenę serwisu liczymy z parametrów oferty według jawnych zasad (w wyjątkowych przypadkach ustawiamy ją ręcznie, a przy ofercie może być podane uzasadnienie).",
    link: { href: "/metodologia", label: "Jak liczymy ocenę" }
  }
];

/** The three questions of the shortcut, picked from the /faq content by id. */
export const HOME_FAQ_IDS = ["podatek", "aktualnosc", "karencja"] as const;

/**
 * The shortcut's items, taken from the /faq source (never copied), in the
 * order of HOME_FAQ_IDS. The same items go to the accordion and to the
 * FAQPage JSON-LD.
 */
export function homeFaqItems(): FaqAccordionItem[] {
  return HOME_FAQ_IDS.map((id) => FAQ_ITEMS.find((item) => item.id === id)).filter(
    (item): item is FaqAccordionItem => item !== undefined
  );
}

export interface HomeHub {
  href: string;
  label: string;
}

/** Hubs linked under the FAQ; each shows only while its page is live (routes.ts). */
export const HOME_HUBS: readonly HomeHub[] = [
  { href: "/konta-osobiste-z-premia", label: "Konta osobiste z premią" },
  { href: "/konta-firmowe-z-premia", label: "Konta firmowe z premią" },
  { href: "/banki", label: "Banki" }
];

/** The hubs whose page exists; `isLive` is injectable for tests. */
export function liveHomeHubs(isLive: (path: string) => boolean = isRouteLive): HomeHub[] {
  return HOME_HUBS.filter((hub) => isLive(hub.href));
}
