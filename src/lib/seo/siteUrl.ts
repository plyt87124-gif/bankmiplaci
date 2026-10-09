/**
 * Single source of the site's public origin and brand name for everything
 * SEO-related (canonical, og:url, JSON-LD @id/url, sitemap, robots).
 *
 * Why this exists: before, five files each did
 * `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"` (one of them
 * with `?? ""`, which produced relative "urls" in JSON-LD). Now there is one
 * normaliser: absolute origin, no trailing slash, no path.
 */

/** Brand name used in titles, OG `siteName` and JSON-LD. */
export const DEFAULT_SITE_NAME = "Bankmiplaci";

/** Last-resort origin, used only when NEXT_PUBLIC_SITE_URL is missing/invalid. */
export const FALLBACK_SITE_URL = "http://localhost:3000";

export interface ResolvedSiteUrl {
  /** Origin with no trailing slash, e.g. `https://bankmiplaci.pl`. */
  url: string;
  /** True when `raw` was empty/invalid and FALLBACK_SITE_URL was used. */
  fromFallback: boolean;
}

/**
 * Pure normaliser (no env, no logging) - this is what the tests exercise.
 * Accepts only http(s); keeps just the origin, so `https://x.pl/` and
 * `https://x.pl/app?x=1` both become `https://x.pl`.
 */
export function resolveSiteUrl(raw: string | null | undefined): ResolvedSiteUrl {
  const value = raw?.trim();
  if (value) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return { url: parsed.origin, fromFallback: false };
      }
    } catch {
      // fall through to the fallback
    }
  }
  return { url: FALLBACK_SITE_URL, fromFallback: true };
}

let warnedAboutFallback = false;

/** Test helper: lets a test observe the "warn once" behaviour again. */
export function resetSiteUrlWarning(): void {
  warnedAboutFallback = false;
}

/**
 * The site's absolute origin (no trailing slash). Falls back to
 * http://localhost:3000 when NEXT_PUBLIC_SITE_URL is unset or invalid and logs
 * a warning ONCE per process - canonical/og:url/sitemap pointing at localhost
 * on production is a silent SEO disaster, so it must at least be loud in logs.
 */
export function siteUrl(): string {
  const { url, fromFallback } = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromFallback && !warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      `[seo] NEXT_PUBLIC_SITE_URL is missing or invalid - falling back to ${FALLBACK_SITE_URL}. ` +
        "Canonical URLs, sitemap and structured data will point there until it is set."
    );
  }
  return url;
}

/** Brand name; NEXT_PUBLIC_SITE_NAME overrides the default (as layout.tsx did). */
export function siteName(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_NAME?.trim();
  return fromEnv ? fromEnv : DEFAULT_SITE_NAME;
}

/**
 * Absolute URL for a site path. `"/"`, `""` and `"promocje"` are all handled;
 * query and hash are preserved; an already absolute http(s) URL is returned
 * unchanged (so it is safe to pass bank logo/website URLs through it).
 */
export function absoluteUrl(path: string = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${clean}`;
}
