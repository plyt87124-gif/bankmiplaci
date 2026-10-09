/**
 * Registry of the public, indexable routes that are listed in sitemap.xml.
 *
 * WHY FLAGS: the sitemap must never list a URL that answers 404. Several
 * pages of the redesign are built by other work packages (WP-13 trust pages,
 * WP-16 hubs/banks/ending-soon/archive) in parallel with this one, so each
 * route carries a `live` flag. When a page is merged, flip its flag to `true`
 * (WP-16's pages: huby, /banki, /banki/[slug], /promocje/konczace-sie, ...).
 * tests/seo-routes.test.ts fails if a `live` route has no page.tsx in
 * src/app, so a flag cannot be switched on early by accident.
 *
 * src/lib/navigation.ts (header/footer links) should read the same flags via
 * isRouteLive() instead of keeping a second list.
 */

/** Which timestamp, if any, a route's <lastmod> is derived from. */
export type LastModSource =
  /** No honest date exists (static copy) - <lastmod> is omitted. */
  | "none"
  /** Newest change among currently open offers. */
  | "openPromotions"
  /** Newest change among currently open non-business offers. */
  | "openPersonalPromotions"
  /** Newest change among currently open business offers. */
  | "openBusinessPromotions"
  /** Newest published/updated article. */
  | "articles";

export interface SiteRoute {
  /** Path without query string; "/" for the home page. */
  path: string;
  /** false = page not merged yet, keep it out of the sitemap. */
  live: boolean;
  lastMod: LastModSource;
}

export const SITE_ROUTES: readonly SiteRoute[] = [
  // Existing pages.
  { path: "/", live: true, lastMod: "openPromotions" },
  { path: "/promocje", live: true, lastMod: "openPromotions" },
  { path: "/porownaj", live: true, lastMod: "openPromotions" },
  { path: "/quiz", live: true, lastMod: "none" },
  { path: "/faq", live: true, lastMod: "none" },
  { path: "/jak-zarabiamy", live: true, lastMod: "none" },
  { path: "/jak-to-dziala", live: true, lastMod: "none" },
  { path: "/blog", live: true, lastMod: "articles" },

  // Trust pages (WP-13).
  { path: "/metodologia", live: true, lastMod: "none" },
  { path: "/o-nas", live: true, lastMod: "none" },

  // Phase 1 hubs (WP-16).
  { path: "/konta-osobiste-z-premia", live: false, lastMod: "openPersonalPromotions" },
  { path: "/konta-firmowe-z-premia", live: false, lastMod: "openBusinessPromotions" },
  { path: "/banki", live: false, lastMod: "openPromotions" },
  { path: "/promocje/konczace-sie", live: false, lastMod: "none" },

  // Phase 2 (WP-16).
  { path: "/promocje/archiwum", live: false, lastMod: "none" },
  { path: "/najlatwiejsze-promocje-bankowe", live: false, lastMod: "openPromotions" },
  { path: "/promocje-bez-oplat", live: false, lastMod: "openPromotions" },
  { path: "/promocje-dla-nowych-klientow", live: false, lastMod: "openPromotions" }
];

/**
 * Dynamic families. `bankPages` = /banki/[slug] (WP-16). Flip to true together
 * with the `/banki` route above, once src/app/banki/[slug]/page.tsx exists.
 */
export const DYNAMIC_ROUTE_FLAGS = {
  bankPages: false
} as const;

/** Is this path listed (and therefore allowed to be linked from navigation)? */
export function isRouteLive(path: string): boolean {
  return SITE_ROUTES.some((r) => r.path === path && r.live);
}

/** Routes that go into the sitemap. */
export function liveRoutes(): SiteRoute[] {
  return SITE_ROUTES.filter((r) => r.live);
}
