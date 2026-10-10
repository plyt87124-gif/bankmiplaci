import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

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

/**
 * A page of the article lives at /blog/{slug}: relative links ("./x", "../x")
 * are resolved against this to learn where the browser would really go
 * ("../out/x" from /blog/{slug} is /out/x).
 */
const ARTICLE_BASE = "https://article.invalid/blog/slug";

/**
 * Host for comparison: lower case, without a leading "www." and without the
 * trailing dot of a fully-qualified name ("www.Example.pl.:8080" -> "example.pl:8080").
 */
function normalizeHost(host: string): string {
  const match = /^(.*?)(:\d+)?$/.exec(host.trim().toLowerCase());
  const name = (match?.[1] ?? "").replace(/\.+$/, "").replace(/^www\./, "");
  return `${name}${match?.[2] ?? ""}`;
}

function isPartnerHost(host: string): boolean {
  const h = normalizeHost(host).replace(/:\d+$/, "");
  return PARTNER_HOSTS.some((partner) => h === partner || h.endsWith(`.${partner}`));
}

function sameSite(host: string, siteHost: string | undefined): boolean {
  return !!siteHost && normalizeHost(host) === normalizeHost(siteHost);
}

/** Is this URL path the affiliate redirect? (Case-insensitive, also when percent-encoded.) */
function isPartnerPath(pathname: string): boolean {
  const candidates = [pathname];
  try {
    candidates.push(decodeURIComponent(pathname));
  } catch {
    // an undecodable path is checked as it is
  }
  return candidates.some((path) => path.toLowerCase().startsWith(PARTNER_PATH_PREFIX));
}

/**
 * `siteHost` is the host (with port, as in `URL.host`) of this site, e.g.
 * "bankmiplaci.pl"; without it absolute URLs are never treated as internal.
 * Hosts are compared without a leading "www." and without a trailing dot.
 *
 * A relative link must start with "/", "./" or "../" (or be a "?query"); text
 * such as "evil.com/x" is not a link target a browser would treat as a path
 * on our site, so it is rejected (null) and the words are printed as text.
 */
export function classifyHref(href: string | null | undefined, siteHost?: string): ClassifiedLink | null {
  if (typeof href !== "string") return null;
  // Browsers drop tabs and newlines inside a URL ("/<TAB>/evil.example" is "//evil.example")
  // and read a backslash as a slash ("/\evil.example" is "//evil.example").
  // eslint-disable-next-line no-control-regex
  const raw = href.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\\/g, "/");
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
      return { kind: isPartnerPath(url.pathname) ? "partner" : "internal", href: path };
    }
    return { kind: "external", href: url.toString() };
  }

  // Relative path: only the forms a browser resolves on this very site.
  if (raw.startsWith("/")) {
    const pathname = raw.split(/[?#]/, 1)[0] ?? "";
    // Dot segments ("/blog/../out/x") are resolved by the browser, so check where it really goes.
    let resolved = pathname;
    try {
      resolved = new URL(pathname, ARTICLE_BASE).pathname;
    } catch {
      // keep the raw path
    }
    return { kind: isPartnerPath(resolved) || isPartnerPath(pathname) ? "partner" : "internal", href: raw };
  }
  if (raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("?")) {
    let url: URL;
    try {
      url = new URL(raw, ARTICLE_BASE);
    } catch {
      return null;
    }
    const path = `${url.pathname}${url.search}${url.hash}`;
    return { kind: isPartnerPath(url.pathname) ? "partner" : "internal", href: path };
  }
  return null;
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

// A minimal structural view of the mdast tree (the real nodes are assignable to it).
interface MdastNode {
  type: string;
  url?: string;
  children?: MdastNode[];
}

/**
 * Link targets as the RENDERER sees them: the markdown is parsed with the same
 * parser and GFM extension as ArticleBody (react-markdown is remark-parse plus
 * remark-gfm), so HTML entities ("&#47;out/x", "&sol;out/x") and backslash
 * escapes ("\/out/x") are already decoded, and literal autolinks are links.
 * Reference definitions are included even when unused (a superset: the worst
 * case is one needless affiliate note, never a missing one).
 */
function parsedHrefs(markdown: string): string[] {
  let tree: MdastNode;
  try {
    tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as unknown as MdastNode;
  } catch {
    return [];
  }
  const found: string[] = [];
  const walk = (node: MdastNode): void => {
    if ((node.type === "link" || node.type === "definition") && typeof node.url === "string" && node.url) {
      found.push(node.url);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return found;
}

/**
 * Hrefs found in a markdown source: those of the parsed tree (what the page
 * renders) plus the raw-text candidates of URL_CANDIDATES (see there for the
 * precision), so nothing is missed either way.
 */
export function extractMarkdownHrefs(markdown: string): string[] {
  const found: string[] = parsedHrefs(markdown);
  for (const pattern of URL_CANDIDATES) {
    for (const match of markdown.matchAll(pattern)) {
      let candidate = (match[1] ?? match[0]).trim();
      if (/^www\./i.test(candidate)) candidate = `http://${candidate}`;
      // Trailing sentence punctuation is not part of a bare URL.
      candidate = candidate.replace(/[.,;:!?'"]+$/, "");
      if (candidate) found.push(candidate);
    }
  }
  return [...new Set(found)];
}

/** Does the article body contain at least one affiliate link? */
export function containsPartnerLinks(markdown: string | null | undefined, siteHost?: string): boolean {
  if (!markdown) return false;
  return extractMarkdownHrefs(markdown).some((href) => classifyHref(href, siteHost)?.kind === "partner");
}

/**
 * Image sources allowed inside an article: https URLs, or a path on this very
 * site ("/obrazy/x.png"). Plain http would be mixed content on an https page;
 * protocol-relative ("//host"), "data:" and everything else is refused (the
 * renderer then prints the alt text instead of an image).
 */
export function safeImageSrc(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const raw = src.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (raw === "") return null;
  if (raw.startsWith("/")) {
    // "//host/x" and "/\host/x" leave the site.
    return raw.startsWith("//") || raw.startsWith("/\\") ? null : raw;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
