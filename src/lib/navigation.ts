/**
 * The ONE list of navigation links (header, mobile menu, footer).
 *
 * Pages built by other work packages (trust pages, hubs, bank pages) must not
 * show up in the navigation before they exist, or a visitor lands on a 404.
 * Such a link is marked `gated`: it is rendered only while
 * `isRouteLive(href)` (src/lib/seo/routes.ts) says the page is live, so
 * flipping that single flag adds the page to the sitemap AND to the
 * navigation. Links without `gated` point to pages that already exist.
 *
 * tests/navigation.test.tsx checks both rules against src/app: an ungated link
 * needs a page.tsx, a gated one needs an entry in SITE_ROUTES, and nothing
 * the visitor would see may point to a missing page.
 *
 * Pure data and functions (no React, no server-only imports): usable from
 * server and client components and from unit tests.
 */
import { isRouteLive } from "@/lib/seo/routes";

export interface NavLink {
  /** Path only: no query string, no hash. */
  href: string;
  label: string;
  /** Show only when `isRouteLive(href)`. Leave out for pages that exist today. */
  gated?: boolean;
}

export interface FooterColumn {
  title: string;
  links: readonly NavLink[];
}

/** Header (from lg) and mobile menu. Order = order on screen. */
export const MAIN_NAV: readonly NavLink[] = [
  { href: "/promocje", label: "Promocje" },
  { href: "/porownaj", label: "Porównaj" },
  { href: "/quiz", label: "Quiz" },
  { href: "/blog", label: "Poradniki" },
  { href: "/jak-to-dziala", label: "Jak to działa" }
];

/** "Moje konto" - shown for signed-in visitors in the header, mobile menu and footer. */
export const ACCOUNT_LINK: NavLink = { href: "/konto", label: "Moje konto" };

/** Footer: spec section 5 (Narzędzia, Wiedza, Zaufanie, Prawo) + the phase 1/2 hubs. */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: "Narzędzia",
    links: [
      { href: "/promocje", label: "Promocje" },
      { href: "/promocje/konczace-sie", label: "Kończące się promocje", gated: true },
      { href: "/porownaj", label: "Porównaj" },
      { href: "/quiz", label: "Quiz" },
      ACCOUNT_LINK
    ]
  },
  {
    title: "Wiedza",
    links: [
      { href: "/blog", label: "Poradniki" },
      { href: "/faq", label: "FAQ" },
      { href: "/jak-to-dziala", label: "Jak to działa" },
      { href: "/konta-osobiste-z-premia", label: "Konta osobiste z premią", gated: true },
      { href: "/konta-firmowe-z-premia", label: "Konta firmowe z premią", gated: true },
      { href: "/banki", label: "Banki", gated: true },
      { href: "/najlatwiejsze-promocje-bankowe", label: "Najłatwiejsze promocje", gated: true },
      { href: "/promocje-bez-oplat", label: "Promocje bez opłat", gated: true },
      { href: "/promocje-dla-nowych-klientow", label: "Dla nowych klientów", gated: true },
      { href: "/promocje/archiwum", label: "Archiwum promocji", gated: true }
    ]
  },
  {
    title: "Zaufanie",
    links: [
      { href: "/jak-zarabiamy", label: "Jak zarabiamy" },
      { href: "/metodologia", label: "Metodologia oceny", gated: true },
      { href: "/o-nas", label: "O nas", gated: true },
      { href: "/kontakt", label: "Kontakt i zgłaszanie błędów" }
    ]
  },
  {
    title: "Prawo",
    links: [
      { href: "/regulamin", label: "Regulamin" },
      { href: "/polityka-prywatnosci", label: "Polityka prywatności" },
      { href: "/cookies", label: "Cookies" }
    ]
  }
];

/** Drops the gated links whose page is not live. `isLive` is injectable for tests. */
export function resolveLinks(links: readonly NavLink[], isLive: (path: string) => boolean = isRouteLive): NavLink[] {
  return links.filter((link) => !link.gated || isLive(link.href));
}

/** Links of the header / mobile menu that may be shown today. */
export function getMainNav(isLive: (path: string) => boolean = isRouteLive): NavLink[] {
  return resolveLinks(MAIN_NAV, isLive);
}

/** Footer columns that may be shown today (a column with no link left is dropped). */
export function getFooterColumns(isLive: (path: string) => boolean = isRouteLive): FooterColumn[] {
  return FOOTER_COLUMNS.map((column) => ({ title: column.title, links: resolveLinks(column.links, isLive) })).filter(
    (column) => column.links.length > 0
  );
}

/**
 * `aria-current` for a navigation link: "page" on the page itself, "true" on
 * a page inside the link's section (e.g. /promocje/mbank-... under
 * "Promocje", /blog/... under "Poradniki"), nothing otherwise. Both values
 * are styled alike. `pathname` may be null (no router context).
 */
export function navAriaCurrent(pathname: string | null | undefined, href: string): "page" | "true" | undefined {
  if (!pathname) return undefined;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === href) return "page";
  if (href !== "/" && path.startsWith(`${href}/`)) return "true";
  return undefined;
}
