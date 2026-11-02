/**
 * Turns a fetched document into the text whose hash is compared between checks
 * (see verification.ts). Pure apart from the hash. PDF text extraction needs the
 * pdftotext binary and lives in scripts/verify-offers.ts; everything after it
 * (normalisation, hash, "is there enough text") is here so it can be tested.
 *
 * The aim is "same words, same numbers => same hash", not byte equality: markup,
 * scripts, styles and spacing do not count, so a re-published page does not look
 * like a change, while any changed amount, date or condition does.
 */
import { createHash } from "node:crypto";
import { MIN_DOCUMENT_CHARS, type SourceSnapshot } from "@/lib/verification";

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", ndash: "–", mdash: "—", hellip: "…" };

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function safeCodePoint(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
}

/** Visible text of an HTML page: no scripts, styles, comments or tags; entities decoded. */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1\s*>/gi, " ");
  return normalizeText(decodeEntities(withoutBlocks.replace(/<[^>]+>/g, " ")));
}

/** Whitespace collapsed (non-breaking spaces and form feeds included), trimmed. */
export function normalizeText(text: string): string {
  return text
    .replace(/[   \f\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** The snapshot of a document that was read (or tried to be) - text is what the page/PDF says, already normalised. */
export function snapshotFromText(url: string, status: number, text: string): SourceSnapshot {
  const normalized = normalizeText(text);
  if (normalized.length < MIN_DOCUMENT_CHARS) {
    return { url, ok: false, status, sha256: null, chars: normalized.length, problem: `za mało tekstu (${normalized.length} znaków) - strona ładowana skryptem lub zablokowana` };
  }
  return { url, ok: true, status, sha256: sha256Hex(normalized), chars: normalized.length };
}

export function failedSnapshot(url: string, status: number | null, problem: string): SourceSnapshot {
  return { url, ok: false, status, sha256: null, chars: null, problem };
}
