/**
 * schema.org JSON-LD builders (docs/redesign-v2/03-content-and-seo-plan.md
 * section C). Every function is pure and returns a plain object (or `null`
 * when there is nothing valid to say); render the result with <JsonLd>
 * (src/components/JsonLd.tsx), never with a bare dangerouslySetInnerHTML.
 *
 * Hard rules encoded here:
 * - NO Review / AggregateRating / rating of any kind. "Ocena serwisu" is an
 *   internal score and self-rating markup is penalised by Google.
 * - Only facts that were passed in. A fee that is null (not verified) is left
 *   out - it is never written as 0.
 * - `@id`s are stable URLs, so nodes emitted on different pages can reference
 *   each other (`{ "@id": ".../#organization" }`).
 */
import { absoluteUrl, siteName, siteUrl } from "./siteUrl";
import { isoDatePL, isoInstant } from "./dates";
import { collapseWhitespace, truncateAtWord } from "./text";
import { formatAmountPlain, promotionHeading } from "./metadata";

export type JsonLdNode = Record<string, unknown>;

const SCHEMA_CONTEXT = "https://schema.org";
const IN_LANGUAGE = "pl-PL";

/** `@id` of the publisher Organization node (same on every page). */
export function organizationId(): string {
  return `${siteUrl()}/#organization`;
}

/** `@id` of the WebSite node (same on every page). */
export function websiteId(): string {
  return `${siteUrl()}/#website`;
}

/** Drops undefined/null/""/[] values (shallow) so output never contains empty properties. */
function compact(node: JsonLdNode): JsonLdNode {
  const out: JsonLdNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Serialisation                                                       */
/* ------------------------------------------------------------------ */

// Built from char codes so no invisible separator ever appears in this source.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * JSON for the inside of `<script type="application/ld+json">`. Escapes `<`
 * (so a title containing `</script>` or `<!--` cannot close or confuse the
 * tag), `>` and `&`, and the line separators U+2028/U+2029 (legal in JSON,
 * but historically a script-parsing hazard). All replacements are valid JSON
 * string escapes, so `JSON.parse(serializeJsonLd(x))` deep-equals `x`.
 */
export function serializeJsonLd(data: unknown): string {
  const json = JSON.stringify(data) ?? "null";
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");
}

/* ------------------------------------------------------------------ */
/* Site-wide nodes                                                     */
/* ------------------------------------------------------------------ */

export interface OrganizationLdOptions {
  /** Logo file; must be a PNG of at least 112x112 px. Default: the app icon. */
  logo?: { path: string; width?: number; height?: number };
  /** Profiles that REALLY exist (e.g. a confirmed TikTok URL). Invalid/non-https entries are dropped. */
  sameAs?: readonly string[];
}

/**
 * Publisher node. `sameAs` is empty unless real profile URLs are passed in;
 * the default logo is /apple-icon.png (180x180) because public/ has no
 * dedicated logo file yet - pass `logo` once one exists.
 */
export function organizationLd(options: OrganizationLdOptions = {}): JsonLdNode {
  const logo = options.logo ?? { path: "/apple-icon.png", width: 180, height: 180 };
  const sameAs = (options.sameAs ?? []).filter((u) => /^https:\/\//i.test(u));
  return compact({
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    "@id": organizationId(),
    name: siteName(),
    url: absoluteUrl("/"),
    logo: compact({
      "@type": "ImageObject",
      url: absoluteUrl(logo.path),
      width: logo.width,
      height: logo.height
    }),
    sameAs
  });
}

export interface WebsiteLdOptions {
  /**
   * Site-search URL up to and including the query key, e.g. "/promocje?q=".
   * Adds a SearchAction; omit it unless that search page really exists.
   */
  searchPath?: string;
}

export function websiteLd(options: WebsiteLdOptions = {}): JsonLdNode {
  return compact({
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    "@id": websiteId(),
    url: absoluteUrl("/"),
    name: siteName(),
    inLanguage: IN_LANGUAGE,
    publisher: { "@id": organizationId() },
    potentialAction: options.searchPath
      ? {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(options.searchPath)}{search_term_string}` },
          "query-input": "required name=search_term_string"
        }
      : undefined
  });
}

/* ------------------------------------------------------------------ */
/* Breadcrumbs, lists, FAQ                                             */
/* ------------------------------------------------------------------ */

export interface BreadcrumbItem {
  name: string;
  /** Site path ("/promocje") or absolute URL. */
  path: string;
}

/** BreadcrumbList without `@context` - for embedding in an `@graph`. */
export function breadcrumbNode(items: readonly BreadcrumbItem[], id?: string): JsonLdNode | null {
  const valid = items.filter((i) => collapseWhitespace(i.name) !== "" && i.path !== "");
  if (valid.length === 0) return null;
  return compact({
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: valid.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: collapseWhitespace(item.name),
      item: absoluteUrl(item.path)
    }))
  });
}

/** Standalone BreadcrumbList, e.g. `breadcrumbLd([{name:"Start",path:"/"},{name:"Promocje",path:"/promocje"}])`. */
export function breadcrumbLd(items: readonly BreadcrumbItem[]): JsonLdNode | null {
  const node = breadcrumbNode(items);
  return node ? { "@context": SCHEMA_CONTEXT, ...node } : null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQPage. Pass the SAME items the page renders (the visible text must match
 * the markup). Returns null when no item has both a question and an answer.
 */
export function faqLd(items: readonly FaqItem[]): JsonLdNode | null {
  const valid = items
    .map((i) => ({ question: collapseWhitespace(i.question), answer: i.answer.trim() }))
    .filter((i) => i.question !== "" && i.answer !== "");
  if (valid.length === 0) return null;
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: valid.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer }
    }))
  };
}

export interface ItemListEntry {
  name: string;
  /** Site path ("/promocje/alior-konto") or absolute URL. */
  path: string;
}

export interface ItemListOptions {
  /** Name of the list itself, e.g. "Aktualne promocje bankowe". */
  name?: string;
  /** Maximum entries (default 10 - the content plan's "top 10"). */
  limit?: number;
}

/** ItemList of the first `limit` entries (default 10); null for an empty list. */
export function itemListLd(items: readonly ItemListEntry[], options: ItemListOptions = {}): JsonLdNode | null {
  const limit = Math.max(1, Math.trunc(options.limit ?? 10));
  const valid = items.filter((i) => collapseWhitespace(i.name) !== "" && i.path !== "").slice(0, limit);
  if (valid.length === 0) return null;
  return compact({
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    name: options.name,
    numberOfItems: valid.length,
    itemListElement: valid.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(item.path),
      name: collapseWhitespace(item.name)
    }))
  });
}

/* ------------------------------------------------------------------ */
/* Offer page                                                          */
/* ------------------------------------------------------------------ */

export interface FeesLdInput {
  accountFeeCents?: number | null;
  accountFeeWaiverCondition?: string | null;
  cardFeeCents?: number | null;
  cardFeeWaiverCondition?: string | null;
  atmFeeCents?: number | null;
  /**
   * Fees.otherFee. Used ONLY as a yes/no flag (its text is free-form and may
   * hold admin remarks, so it is never copied into the markup): when it is
   * filled in, the fee statement says that further conditions apply.
   */
  otherFee?: string | null;
  /** Bank's fee table; used as the value only when no fee field is usable. */
  sourceUrl?: string | null;
}

function feeSentence(
  label: string,
  cents: number | null | undefined,
  waiver: string | null | undefined,
  hasCaveat = false
): string | null {
  if (cents == null || !Number.isFinite(cents) || cents < 0) return null; // not verified -> say nothing
  const condition = waiver ? collapseWhitespace(waiver) : "";
  if (condition) {
    // A waiver means `cents` is the fee WITHOUT the condition. "0 zł + condition"
    // is contradictory data (the site shows it as unknown), so it is skipped.
    if (cents === 0) return null;
    return `${label}: ${formatAmountPlain(cents)} (0 zł po spełnieniu warunku: ${truncateAtWord(condition, 200)}).`;
  }
  // The site's convention: 0 = best case, the catch is described in otherFee.
  // Then a bare "0 zł" would overstate it.
  if (cents === 0 && hasCaveat) return `${label}: od 0 zł, zależnie od warunków opisanych w taryfie banku.`;
  return `${label}: ${formatAmountPlain(cents)}.`;
}

/**
 * Text for FinancialProduct.feesAndCommissionsSpecification built ONLY from
 * verified fee fields (non-null). Free-text `otherFee` is never used - it can
 * contain admin remarks. Returns null when nothing is verified.
 */
export function feesSpecificationText(fees: FeesLdInput | null | undefined): string | null {
  if (!fees) return null;
  const hasCaveat = Boolean(fees.otherFee && collapseWhitespace(fees.otherFee) !== "");
  const sentences = [
    feeSentence("Opłata za prowadzenie konta", fees.accountFeeCents, fees.accountFeeWaiverCondition, hasCaveat),
    feeSentence("Opłata za kartę", fees.cardFeeCents, fees.cardFeeWaiverCondition, hasCaveat),
    feeSentence("Opłata za wypłatę z bankomatu", fees.atmFeeCents, null)
  ].filter((s): s is string => s !== null);
  if (sentences.length === 0) return null;
  // The site shows a numeric fee as the best case and explains the catch in
  // otherFee (see the fee convention in schema.prisma). Do not let the markup
  // read as an unconditional promise.
  if (fees.otherFee && collapseWhitespace(fees.otherFee) !== "") {
    sentences.push("Szczegółowe warunki i pozostałe opłaty: w taryfie opłat i prowizji banku.");
  }
  return sentences.join(" ");
}

const ACCOUNT_TYPE_CATEGORY: Record<string, string> = {
  PERSONAL: "Promocja na konto osobiste",
  SAVINGS: "Promocja na konto oszczędnościowe",
  YOUNG: "Promocja na konto dla młodych",
  BUSINESS: "Promocja na konto firmowe",
  JOINT: "Promocja na konto wspólne"
};

export interface PromotionLdInput {
  slug: string;
  /** Offer name (Promotion.name) - becomes FinancialProduct.name. */
  name: string;
  bankName: string;
  /** Bank website (Bank.website) - dropped unless a valid http(s) URL. */
  bankWebsite?: string | null;
  /** Bank logo (Bank.logoUrl) - absolute URL or site path. */
  bankLogoUrl?: string | null;
  /** Prisma AccountType. */
  accountType?: string | null;
  /** Meta description of the page (makeDescription output) or the offer summary. */
  description?: string | null;
  /** Promotion.lastVerifiedAt -> WebPage.dateModified. */
  lastVerifiedAt?: Date | string | null;
  /** Last sign-up day -> Offer.validThrough (date only). */
  endDate?: Date | string | null;
  /**
   * First day of the offer -> Offer.validFrom. Pass it ONLY when the date is
   * the real start of the promotion; omit it when startDate is a placeholder.
   */
  startDate?: Date | string | null;
  fees?: FeesLdInput | null;
  /** Visible breadcrumb trail of the page (Start / Promocje / ...). */
  breadcrumbs?: readonly BreadcrumbItem[];
  /** Page heading; default `promotionHeading()`. */
  heading?: string;
}

/**
 * `@graph` for an offer page: WebPage (+ BreadcrumbList) + FinancialProduct.
 * The WebPage references the WebSite/Organization by `@id` (those nodes are
 * emitted once, on the home page). `Offer` carries only dates - no price, no
 * availability claim, no rating.
 */
export function promotionLd(p: PromotionLdInput): JsonLdNode {
  const path = `/promocje/${p.slug}`;
  const url = absoluteUrl(path);
  const productId = `${url}#produkt`;
  const pageId = `${url}#strona`;
  const breadcrumbId = `${url}#okruszki`;
  const heading = p.heading ?? promotionHeading({ name: p.name, bankName: p.bankName });
  const description = p.description ? collapseWhitespace(p.description) : undefined;

  const breadcrumb = p.breadcrumbs ? breadcrumbNode(p.breadcrumbs, breadcrumbId) : null;

  const validFrom = isoDatePL(p.startDate);
  const validThrough = isoDatePL(p.endDate);
  const offers =
    validFrom || validThrough
      ? compact({ "@type": "Offer", url, validFrom: validFrom ?? undefined, validThrough: validThrough ?? undefined })
      : undefined;

  const feesText = feesSpecificationText(p.fees);
  const feesUrl = !feesText && isHttpUrl(p.fees?.sourceUrl) ? p.fees?.sourceUrl : undefined;

  const bankWebsite = isHttpUrl(p.bankWebsite) ? p.bankWebsite : undefined;
  const provider = compact({
    "@type": "BankOrCreditUnion",
    name: collapseWhitespace(p.bankName),
    url: bankWebsite,
    logo: p.bankLogoUrl ? absoluteUrl(p.bankLogoUrl) : undefined
  });

  const product = compact({
    "@type": "FinancialProduct",
    "@id": productId,
    name: collapseWhitespace(p.name),
    category: (p.accountType ? ACCOUNT_TYPE_CATEGORY[p.accountType] : undefined) ?? "Promocja bankowa",
    provider,
    description,
    feesAndCommissionsSpecification: feesText ?? feesUrl,
    url,
    offers
  });

  const webPage = compact({
    "@type": "WebPage",
    "@id": pageId,
    url,
    name: heading,
    description,
    inLanguage: IN_LANGUAGE,
    isPartOf: { "@id": websiteId() },
    breadcrumb: breadcrumb ? { "@id": breadcrumbId } : undefined,
    dateModified: isoInstant(p.lastVerifiedAt) ?? undefined,
    mainEntity: { "@id": productId }
  });

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": breadcrumb ? [webPage, breadcrumb, product] : [webPage, product]
  };
}

/* ------------------------------------------------------------------ */
/* Article                                                             */
/* ------------------------------------------------------------------ */

export interface ArticleLdInput {
  slug: string;
  title: string;
  /** Article.excerpt. */
  description?: string | null;
  /** Absolute URL or site path of the lead image. Default: the site-wide social image. */
  image?: string | null;
  publishedAt?: Date | string | null;
  /** Article.contentUpdatedAt ONLY (never updatedAt, which changes on unrelated writes). */
  modifiedAt?: Date | string | null;
  authorName: string;
  /** Author profile URL or path (e.g. the editorial page). Omit when there is none. */
  authorUrl?: string | null;
}

/** Google's guideline for Article.headline. */
export const ARTICLE_HEADLINE_MAX = 110;

export function articleLd(a: ArticleLdInput): JsonLdNode {
  const url = absoluteUrl(`/blog/${a.slug}`);
  return compact({
    "@context": SCHEMA_CONTEXT,
    "@type": "Article",
    "@id": `${url}#artykul`,
    headline: truncateAtWord(a.title, ARTICLE_HEADLINE_MAX),
    description: a.description ? collapseWhitespace(a.description) : undefined,
    image: [absoluteUrl(a.image || "/opengraph-image")],
    datePublished: isoInstant(a.publishedAt) ?? undefined,
    dateModified: isoInstant(a.modifiedAt) ?? undefined,
    inLanguage: IN_LANGUAGE,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: compact({
      "@type": "Person",
      name: collapseWhitespace(a.authorName),
      url: a.authorUrl ? absoluteUrl(a.authorUrl) : undefined
    }),
    publisher: { "@id": organizationId() }
  });
}
