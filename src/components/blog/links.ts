/**
 * Classification of the links inside an article (markdown body). Pure: no
 * React, no database, the site host is a parameter - so the rules live in one
 * place and are unit-tested.
 *
 *   anchor    "#fragment" on the same page
 *   internal  a page of this site (relative path, or an absolute URL on our host)
 *   partner   an affiliate link: our redirect /out/... (which records the click
 *             and goes to the bank) or the partner network's own host
 *   external  any other http(s) site
 *   other     mailto:
 *
 * Anything else (javascript:, data:, tel:, a malformed URL) classifies as
 * `null`: the renderer then prints the link text without a link.
 */
export type LinkKind = "anchor" | "internal" | "partner" | "external" | "other";

export interface ClassifiedLink {
  kind: LinkKind;
  /** What goes into href: same-site absolute URLs are reduced to path + query + hash. */
  href: string;
}

/** Path prefix of the affiliate redirect (src/app/out/[slug]). */
export const PARTNER_PATH_PREFIX = "/out/";

/** Hosts of the affiliate network (the host itself and its subdomains). */
export const PARTNER_HOSTS: readonly string[] = ["ebrokerpartner.pl"];

function isPartnerHost(host: string): boolean {
  const h = host.toLowerCase();
  return PARTNER_HOSTS.some((partner) => h === partner || h.endsWith(`.${partner}`));
}

function sameSite(host: string, siteHost: string | undefined): boolean {
  return !!siteHost && host.toLowerCase() === siteHost.toLowerCase();
}

/**
 * `siteHost` is the host (with port, as in `URL.host`) of this site, e.g.
 * "bankmiplaci.pl"; without it absolute URLs are never treated as internal.
 */
export function classifyHref(href: string | null | undefined, siteHost?: string): ClassifiedLink | null {
  if (typeof href !== "string") return null;
  // Browsers read a backslash as a slash in a URL: "/\evil.example" is "//evil.example".
  const raw = href.trim().replace(/\\/g, "/");
  if (raw === "") return null;

  if (raw.startsWith("#")) return { kind: "anchor", href: raw };

  // Absolute (http, https, mailto, javascript ...) or protocol-relative ("//host/path").
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw);
  if (scheme || raw.startsWith("//")) {
    const protocol = scheme ? scheme[1]!.toLowerCase() : "https";
    if (protocol === "mailto") return { kind: "other", href: raw };
    if (protocol !== "http" && protocol !== "https") return null;

    let url: URL;
    try {
      url = new URL(scheme ? raw : `https:${raw}`);
    } catch {
      return null;
    }
    if (isPartnerHost(url.hostname)) return { kind: "partner", href: url.toString() };
    if (sameSite(url.host, siteHost)) {
      const path = `${url.pathname}${url.search}${url.hash}`;
      return { kind: url.pathname.startsWith(PARTNER_PATH_PREFIX) ? "partner" : "internal", href: path };
    }
    return { kind: "external", href: url.toString() };
  }

  // Relative path.
  const pathname = raw.split(/[?#]/, 1)[0] ?? "";
  return { kind: pathname.startsWith(PARTNER_PATH_PREFIX) ? "partner" : "internal", href: raw };
}

// Everything in a markdown source that can be a link target. Deliberately a
// superset of what the renderer turns into <a>: it is only used to decide
// whether to show the affiliate note, so an extra match (e.g. a URL inside a
// code span) merely shows the note, and nothing is ever missed.
const URL_CANDIDATES: readonly RegExp[] = [
  // [text](url), [text](<url>), ![alt](url)
  /\]\(\s*<?([^\s)>]+)/g,
  // [label]: url   (reference definitions)
  /^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*<?([^\s>]+)/gm,
  // <https://...> and bare http(s):// URLs (GFM literal autolinks)
  /\bhttps?:\/\/[^\s<>()[\]]+/gi,
  // bare www.... URLs (GFM turns them into http://www....)
  /(?<![\w/.])www\.[^\s<>()[\]]+/gi
];

/** Hrefs found in a markdown source (see URL_CANDIDATES for the precision). */
export function extractMarkdownHrefs(markdown: string): string[] {
  const found: string[] = [];
  for (const pattern of URL_CANDIDATES) {
    for (const match of markdown.matchAll(pattern)) {
      let candidate = (match[1] ?? match[0]).trim();
      if (/^www\./i.test(candidate)) candidate = `http://${candidate}`;
      // Trailing sentence punctuation is not part of a bare URL.
      candidate = candidate.replace(/[.,;:!?'"]+$/, "");
      if (candidate) found.push(candidate);
    }
  }
  return found;
}

/** Does the article body contain at least one affiliate link? */
export function containsPartnerLinks(markdown: string | null | undefined, siteHost?: string): boolean {
  if (!markdown) return false;
  return extractMarkdownHrefs(markdown).some((href) => classifyHref(href, siteHost)?.kind === "partner");
}
