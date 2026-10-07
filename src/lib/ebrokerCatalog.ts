// Pure helpers for the public eBrokerPartner XML catalog: parsing and diffing.
// No IO, no Prisma, no env — the caller fetches the XML and stores the result.
//
// What the catalog does NOT contain: dates, editions, fees or statuses. So a
// campaign being present never proves its promotion is valid, and a campaign
// disappearing never proves it ended; both only raise a flag for review.
import { createHash } from "node:crypto";

export type CatalogOffer = {
  oid: string;
  name: string;
  institution: string;
  category: string;
  subcategory: string;
  /** Plain text: HTML tags removed, entities decoded, whitespace collapsed. */
  description: string;
  trackingUrl: string;
};

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith("#")) {
      const code = e.charAt(1).toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(html)
    .replace(/<\s*(br|\/li|\/p|\/div|\/ul)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function field(block: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return m ? decodeEntities(m[1] ?? "").trim() : "";
}

/**
 * Parses the catalog. Throws when the document is not a catalog or an offer is
 * malformed — a half-read feed must never be diffed (it would look like mass
 * removals).
 */
export function parseCatalogXml(xml: string): CatalogOffer[] {
  if (!/<offers[\s>]/i.test(xml) || !/<\/offers>\s*$/i.test(xml.trim())) {
    throw new Error("To nie jest kompletny katalog eBroker (brak <offers>…</offers>).");
  }
  const blocks = xml.match(/<offer>[\s\S]*?<\/offer>/gi) ?? [];
  const seen = new Set<string>();
  return blocks.map((block) => {
    const oid = field(block, "oid");
    if (!/^\d+$/.test(oid)) throw new Error(`Oferta bez poprawnego oid: ${block.slice(0, 80)}`);
    if (seen.has(oid)) throw new Error(`Zdublowany oid ${oid} w katalogu.`);
    seen.add(oid);
    const trackingUrl = field(block, "url");
    if (!/^https:\/\//.test(trackingUrl)) throw new Error(`Oferta ${oid}: link musi zaczynać się od https://`);
    return {
      oid,
      name: field(block, "name"),
      institution: field(block, "institution"),
      category: field(block, "category"),
      subcategory: field(block, "subcategory"),
      description: htmlToText(field(block, "description")),
      trackingUrl
    };
  });
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ")
    .trim();

/** Personal and business current accounts — the offers this site compares. */
export function isWatchedOffer(o: Pick<CatalogOffer, "category" | "subcategory">): boolean {
  const c = fold(o.category);
  const s = fold(o.subcategory);
  return (c === "konta/karty" && s === "konta osobiste") || (c === "dla firm" && s === "konta firmowe");
}

export function offerAccountType(o: Pick<CatalogOffer, "category">): "PERSONAL" | "BUSINESS" {
  return fold(o.category) === "dla firm" ? "BUSINESS" : "PERSONAL";
}

export function contentHash(o: Pick<CatalogOffer, "name" | "description">): string {
  return createHash("sha256").update(`${o.name}\n${o.description}`).digest("hex");
}

export type StoredCampaign = {
  oid: string;
  contentHash: string;
  watched: boolean;
  ignored: boolean;
  missingSince: Date | null;
};

export type CatalogDiff = {
  added: CatalogOffer[];
  changed: CatalogOffer[];
  /** Watched, previously seen, not in this catalog, and not already flagged missing. */
  newlyMissing: string[];
  /** Were flagged missing and are back. */
  returned: string[];
  /** Set when the catalog looks truncated; then `newlyMissing` is deliberately empty. */
  suspectIncomplete: boolean;
};

/**
 * Compares today's catalog with what is stored. A catalog that lost a large share
 * of the known watched offers is treated as a broken read, not as mass removals.
 */
export function diffCatalog(stored: StoredCampaign[], offers: CatalogOffer[]): CatalogDiff {
  const byOid = new Map(stored.map((s) => [s.oid, s]));
  const current = new Set(offers.map((o) => o.oid));

  const added: CatalogOffer[] = [];
  const changed: CatalogOffer[] = [];
  const returned: string[] = [];
  for (const o of offers) {
    const prev = byOid.get(o.oid);
    if (!prev) {
      if (isWatchedOffer(o)) added.push(o);
      continue;
    }
    if (prev.ignored) continue;
    if (prev.missingSince) returned.push(o.oid);
    if (prev.contentHash !== contentHash(o) && (prev.watched || isWatchedOffer(o))) changed.push(o);
  }

  const knownWatched = stored.filter((s) => s.watched && !s.ignored);
  const missing = knownWatched.filter((s) => !current.has(s.oid));
  const suspectIncomplete =
    offers.length === 0 || (knownWatched.length >= 6 && missing.length > Math.max(3, knownWatched.length * 0.3));
  const newlyMissing = suspectIncomplete ? [] : missing.filter((s) => !s.missingSince).map((s) => s.oid);

  return { added, changed, newlyMissing, returned, suspectIncomplete };
}
