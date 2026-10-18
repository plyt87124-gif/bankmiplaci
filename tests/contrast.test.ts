import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * WCAG 2.x contrast of the colour tokens in src/app/globals.css, both themes.
 *
 * The tokens are parsed from the CSS (`--color-name: R G B;` in `:root` and
 * `.dark`), so the test follows the real palette: change a token and this test
 * recomputes. Ratio = (L1 + 0.05) / (L2 + 0.05) with relative luminance from
 * linearised sRGB (WCAG 2.x, 1.4.3 text and 1.4.11 non-text).
 *
 *   - TEXT_PAIRS: >= 4.5:1 (body text and small text; the site has no "large
 *     text only" pair, so the strict threshold is used everywhere).
 *   - UI_PAIRS:   >= 3:1 (control borders, focus ring, icons / graphics that
 *     carry meaning).
 *
 * Tokens that are deliberately NOT asserted (decoration only) are listed in
 * DECORATIVE_ONLY with the reason. A failure prints every pair with its ratio.
 */

const CSS = readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8");

type Rgb = readonly [number, number, number];
type Theme = "light" | "dark";

function parseTokens(css: string): Record<Theme, Map<string, Rgb>> {
  const light = new Map<string, Rgb>();
  const darkOverrides = new Map<string, Rgb>();
  for (const block of css.matchAll(/(:root|\.dark)\s*\{([^}]*)\}/g)) {
    const target = block[1] === ":root" ? light : darkOverrides;
    for (const decl of block[2]!.matchAll(/--color-([\w-]+)\s*:\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g)) {
      target.set(decl[1]!, [Number(decl[2]), Number(decl[3]), Number(decl[4])]);
    }
  }
  // `.dark` redefines most tokens; whatever it does not redefine keeps the :root value.
  const dark = new Map<string, Rgb>([...light, ...darkOverrides]);
  return { light, dark };
}

const TOKENS = parseTokens(CSS);

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratioOf(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE: Rgb = [255, 255, 255];

function colour(theme: Theme, name: string): Rgb {
  if (name === "#white") return WHITE;
  const value = TOKENS[theme].get(name);
  assert.ok(value, `token --color-${name} is not defined for the ${theme} theme in globals.css`);
  return value;
}

// ------------------------------------------------------------------ pair tables

interface Pair {
  fg: string;
  bg: string[];
  /** where it is used - shown on failure so the fix can target the right place */
  use: string;
}

const NEUTRAL_BG = ["paper", "surface", "sunken"];
const TINTS = ["teal-100", "gold-100", "coral-100", "success-100", "info-100"];

const TEXT_PAIRS: Pair[] = [
  { fg: "ink-900", bg: [...NEUTRAL_BG, "ink-100", ...TINTS], use: "headings, amounts, body on cards / blocks / chips / badges" },
  { fg: "ink-700", bg: [...NEUTRAL_BG, "ink-100", ...TINTS], use: "body text, neutral badge, ghost button, unlocked-month text on gold-100" },
  { fg: "ink-500", bg: [...NEUTRAL_BG, "ink-100"], use: "helper text, labels, disclosures, disabled controls, placeholders" },
  { fg: "ink-400", bg: NEUTRAL_BG, use: "faintest allowed text (dates, footnotes) - NOT on ink-100 (see ui-tokens test)" },
  { fg: "action", bg: [...NEUTRAL_BG, "teal-100"], use: "links, text buttons, active filter label" },
  { fg: "action-hover", bg: NEUTRAL_BG, use: "link / text-button hover colour" },
  { fg: "teal-700", bg: ["teal-100", "paper", "surface"], use: "verified badge, selected chip / current nav item" },
  { fg: "on-action", bg: ["action", "action-hover"], use: "primary / cta button label and checkbox tick (normal and hover)" },
  { fg: "on-coral", bg: ["coral-600"], use: "danger button label" },
  { fg: "success", bg: ["success-100", ...NEUTRAL_BG], use: "success badge, saved / confirmation message" },
  { fg: "info", bg: ["info-100", ...NEUTRAL_BG], use: "info badge, hint message" },
  { fg: "gold-600", bg: ["gold-100", ...NEUTRAL_BG], use: "warn badge (deadline <= 14 days), reward amount, warning message" },
  { fg: "coral-600", bg: ["coral-100", "ink-100", ...NEUTRAL_BG], use: "error text, expired banner, danger badge, liked heart on hover" },
  { fg: "#white", bg: ["ink-solid"], use: "LEGACY admin buttons: literal white text on the fixed plate" }
];

const UI_PAIRS: Pair[] = [
  { fg: "line-strong", bg: NEUTRAL_BG, use: "borders of inputs, selects, checkboxes, secondary buttons (WCAG 1.4.11)" },
  { fg: "focus-ring", bg: [...NEUTRAL_BG, "teal-100"], use: "2 px :focus-visible outline" },
  { fg: "gold-500", bg: ["gold-100", ...NEUTRAL_BG], use: "icons / borders on warn blocks and reward rows (bar next to icon + text)" },
  { fg: "teal-600", bg: [...NEUTRAL_BG, "teal-100"], use: "icons, selected-comment border" },
  { fg: "teal-500", bg: ["ink-100", "surface"], use: "progress bar fill against its track (graphic)" },
  { fg: "action", bg: ["paper", "surface"], use: "active chip / button fill against the page, checked checkbox box" }
];

/** Tokens intentionally outside the thresholds. Not asserted; listed so the gap is visible and justified. */
const DECORATIVE_ONLY: Record<string, string> = {
  "ink-300": "icons and decoration only (spec section 2; ui-tokens test bans it as text) - also the disabled+checked checkbox, which WCAG exempts",
  line: "card borders and separators - decoration; the meaning is carried by text/headings and, for controls, by line-strong",
  "ink-100": "fill only (chips, skeleton, checkbox background) - no text-on-it pair other than those asserted above",
  "ink-solid": "LEGACY fill of the v1 admin panel, always paired with literal white text (asserted above)",
  "logo-tile": "constant white tile for bank logos in both themes",
  "brand-soft": "the lighter \"mi\" of the wordmark: a logo letter pair, exempt from text contrast (the word as a whole is read in action colour)"
};

// ------------------------------------------------------------------ evaluation

interface Row {
  theme: Theme;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  use: string;
}

function evaluate(pairs: Pair[], min: number): Row[] {
  const rows: Row[] = [];
  for (const theme of ["light", "dark"] as const) {
    for (const p of pairs) {
      for (const bg of p.bg) {
        rows.push({ theme, fg: p.fg, bg, ratio: ratioOf(colour(theme, p.fg), colour(theme, bg)), min, use: p.use });
      }
    }
  }
  return rows;
}

function table(rows: Row[]): string {
  return rows
    .map((r) => `  ${r.theme.padEnd(5)} ${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)}:1 (need >= ${r.min}:1)  - ${r.use}`)
    .join("\n");
}

// ------------------------------------------------------------------ tests

test("contrast: the formula matches known WCAG values", () => {
  assert.equal(ratioOf([0, 0, 0], WHITE).toFixed(2), "21.00");
  assert.equal(ratioOf(WHITE, WHITE).toFixed(2), "1.00");
  // #767676 on white is the textbook 4.54:1 pass.
  assert.equal(ratioOf([118, 118, 118], WHITE).toFixed(2), "4.54");
  // Spec section 2 quotes: ink-900/paper ~15.9; the navy action colour on paper is >= 10 (light).
  const inkOnPaper = ratioOf(colour("light", "ink-900"), colour("light", "paper"));
  assert.ok(inkOnPaper > 15.5 && inkOnPaper < 16.5, `ink-900/paper light = ${inkOnPaper.toFixed(2)}`);
  const actionOnPaper = ratioOf(colour("light", "action"), colour("light", "paper"));
  assert.ok(actionOnPaper > 10 && actionOnPaper < 16, `action/paper light = ${actionOnPaper.toFixed(2)}`);
});

test("contrast: globals.css defines the same token set in both themes", () => {
  const needed = new Set<string>();
  for (const p of [...TEXT_PAIRS, ...UI_PAIRS]) {
    needed.add(p.fg);
    p.bg.forEach((b) => needed.add(b));
  }
  needed.delete("#white");
  for (const theme of ["light", "dark"] as const) {
    for (const name of needed) assert.ok(TOKENS[theme].has(name), `--color-${name} missing in ${theme}`);
  }
  // Only the documented tokens may be left out of the tables.
  const covered = new Set([...needed, ...Object.keys(DECORATIVE_ONLY)]);
  const unaccounted = [...TOKENS.light.keys()].filter((k) => !covered.has(k));
  // Aliases of a family member that is asserted under its own name.
  const aliases = new Set(["teal-700", "on-coral", "warn", "warn-100"]);
  assert.deepEqual(
    unaccounted.filter((k) => !aliases.has(k)),
    [],
    "token(s) in globals.css that are neither asserted nor listed in DECORATIVE_ONLY"
  );
});

test("contrast: text pairs reach 4.5:1 in the light and dark theme", (t) => {
  const rows = evaluate(TEXT_PAIRS, 4.5);
  t.diagnostic(`tightest text pairs:
${table([...rows].sort((a, b) => a.ratio - b.ratio).slice(0, 8))}`);
  const failing = rows.filter((r) => r.ratio < r.min);
  assert.equal(failing.length, 0, `\nText pairs below 4.5:1:\n${table(failing)}\n\nAll text pairs:\n${table(rows)}\n`);
});

test("contrast: borders, focus ring and graphics reach 3:1 in the light and dark theme", (t) => {
  const rows = evaluate(UI_PAIRS, 3);
  t.diagnostic(`tightest non-text pairs:
${table([...rows].sort((a, b) => a.ratio - b.ratio).slice(0, 8))}`);
  const failing = rows.filter((r) => r.ratio < r.min);
  assert.equal(failing.length, 0, `\nNon-text pairs below 3:1:\n${table(failing)}\n\nAll non-text pairs:\n${table(rows)}\n`);
});

test("contrast: documented decoration-only tokens are not silently used as asserted pairs", () => {
  for (const [name, reason] of Object.entries(DECORATIVE_ONLY)) {
    assert.ok(TOKENS.light.has(name) && TOKENS.dark.has(name), `DECORATIVE_ONLY lists --color-${name}, which is not defined`);
    assert.ok(reason.length > 20);
  }
  // ink-300 really is too faint for text - if someone darkens it, the exception can be dropped.
  const ink300 = ratioOf(colour("light", "ink-300"), colour("light", "surface"));
  assert.ok(ink300 < 4.5, `ink-300/surface light = ${ink300.toFixed(2)}: now passes - revisit the ui-tokens ban`);
});

test("contrast: colours hard-coded in globals.css data-URI icons equal their tokens", () => {
  const hex = (rgb: Rgb) => rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
  // Select chevron: ink-500 in each theme. Checkbox tick: on-action in each theme.
  const selectLight = CSS.match(/(?<!\.dark )\.select \{\s*@apply appearance-none[\s\S]*?stroke='%23([0-9a-f]{6})'/);
  assert.equal(selectLight?.[1], hex(colour("light", "ink-500")), "light select chevron stroke must equal ink-500");
  const darkSelect = CSS.match(/\.dark \.select \{[\s\S]*?stroke='%23([0-9a-f]{6})'/);
  assert.equal(darkSelect?.[1], hex(colour("dark", "ink-500")), "dark select chevron stroke must equal ink-500");
  const tickLight = CSS.match(/\.checkbox:checked \{[\s\S]*?stroke='%23([0-9a-f]{6})'/);
  assert.equal(tickLight?.[1], hex(colour("light", "on-action")), "light checkbox tick must equal on-action");
  const tickDark = CSS.match(/\.dark \.checkbox:checked \{[\s\S]*?stroke='%23([0-9a-f]{6})'/);
  assert.equal(tickDark?.[1], hex(colour("dark", "on-action")), "dark checkbox tick must equal on-action");
});
