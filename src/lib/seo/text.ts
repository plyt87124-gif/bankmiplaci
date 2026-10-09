/**
 * Small pure text helpers shared by the SEO builders.
 */

/** Collapses every run of whitespace (incl. newlines, nbsp) into one space and trims. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Polish plural picker: 1 -> one; ends in 2-4 but not 12-14 -> few; else many
 * (so 0, 5-21, 25-31 ... -> many). Same rule as format.ts `pluralizePl` of the
 * foundation package; duplicated here deliberately so the SEO package has no
 * dependency on it.
 */
export function pluralForm(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

// One-letter / very short Polish words that must not end a shortened text
// ("... konto własne i" reads like a bug).
const DANGLING_WORDS = new Set([
  "a", "i", "o", "u", "w", "z", "do", "na", "po", "za", "od", "ze", "we", "ku", "oraz", "lub", "albo", "że", "to", "co"
]);

const TRAILING_JUNK = /[\s,;:–—\-+(\[/&|]+$/;

/**
 * Shortens `text` to at most `max` characters (ellipsis included) on a word
 * boundary. Never leaves a dangling separator or one-letter preposition before
 * the ellipsis. Returns the (whitespace-collapsed) text unchanged when it
 * already fits.
 */
export function truncateAtWord(text: string, max: number, ellipsis = "…"): string {
  const t = collapseWhitespace(text);
  if (t.length <= max) return t;
  const limit = Math.max(0, max - ellipsis.length);
  let cut: string;
  if (t.charAt(limit) === " ") {
    cut = t.slice(0, limit);
  } else {
    const head = t.slice(0, limit);
    const idx = head.lastIndexOf(" ");
    // Prefer a word boundary unless it would throw away most of the text.
    cut = idx >= Math.floor(limit * 0.4) ? head.slice(0, idx) : head;
  }
  // Strip separators and dangling short words until stable.
  for (;;) {
    const before = cut;
    cut = cut.replace(TRAILING_JUNK, "");
    const lastSpace = cut.lastIndexOf(" ");
    const lastWord = cut.slice(lastSpace + 1).toLowerCase();
    if (lastSpace > 0 && DANGLING_WORDS.has(lastWord)) cut = cut.slice(0, lastSpace);
    if (cut === before) break;
  }
  cut = cut.replace(/[.…]+$/, "");
  return cut + ellipsis;
}

/** Lower-cases and removes Polish diacritics - for loose "does the name contain X" checks. */
export function foldPolish(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}
