import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Regression test of the forbidden design patterns of "Papier i tusz" (v2):
 * docs/redesign-v2/01-design-spec.md, section 2 ("Zasady uzycia"), section 3
 * (typography) and section 7 (token migration), plus a few security/privacy
 * invariants that are cheap to check statically (rel on target=_blank, no
 * hand-written dangerouslySetInnerHTML, one source of the site URL).
 *
 * It reads src/**\/*.{ts,tsx,css} (no admin panel - v1 is outside the redesign,
 * no test files), strips comments (so docs may mention a forbidden class) and
 * reports every violation as `file:line`. Every rule has self-check samples
 * (`bad` must match, `good` must not), so a rule cannot silently stop working,
 * and every exception is verified to be still needed (a stale exception fails).
 *
 * The commission invariants (affiliateCommissionCents) are covered by
 * tests/commission-privacy.test.ts - deliberately not duplicated here.
 */

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const EXTS = new Set([".ts", ".tsx", ".css"]);

// ------------------------------------------------------------------ file set

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

interface SourceFile {
  /** posix path relative to the repo root, e.g. src/components/Header.tsx */
  rel: string;
  ext: ".ts" | ".tsx" | ".css";
  /** text with comments blanked out (line numbers preserved) */
  text: string;
}

/** Blank out comments but keep every newline, so match offsets map to the real line. */
function stripComments(source: string, ext: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  let out = source.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (ext !== ".css") {
    // `//` only after whitespace/punctuation, so URLs inside strings ("https://...") survive.
    out = out.replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)));
  }
  return out;
}

const FILES: SourceFile[] = walk(SRC)
  .map((full) => ({ full, rel: relative(ROOT, full).split(sep).join("/") }))
  .filter(({ rel }) => {
    const ext = rel.slice(rel.lastIndexOf("."));
    if (!EXTS.has(ext)) return false;
    if (rel.startsWith("src/app/admin/")) return false; // panel v1 - outside the redesign
    if (/\.test\.[tj]sx?$/.test(rel) || /\.d\.ts$/.test(rel)) return false;
    return true;
  })
  .map(({ full, rel }) => {
    const ext = rel.slice(rel.lastIndexOf(".")) as SourceFile["ext"];
    return { rel, ext, text: stripComments(readFileSync(full, "utf8"), ext) };
  });

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function lineText(text: string, line: number): string {
  return (text.split("\n")[line - 1] ?? "").trim().slice(0, 140);
}

// ------------------------------------------------------------------ rule model

interface Exception {
  /** exact posix path, or a directory prefix ending with "/" */
  file: string;
  /** optional: the exception applies only to lines matching this */
  line?: RegExp;
  /** why the use is correct - mandatory */
  reason: string;
}

interface Rule {
  id: string;
  description: string;
  pattern: RegExp;
  /** limit the rule to some file types (default: ts, tsx, css) */
  exts?: Array<SourceFile["ext"]>;
  exceptions?: Exception[];
  /** self-check: each must match `pattern` */
  bad: string[];
  /** self-check: none may match `pattern` */
  good: string[];
}

const RULES: Rule[] = [
  {
    id: "ink-300-text",
    description: "text-ink-300 jest tylko dla ikon/dekoracji (1,9:1 na papierze) - dla tekstu ink-400 (meta) lub ink-500 (zastrzezenia)",
    pattern: /(?<![\w-])(?:text|placeholder|caret|decoration)-ink-300(?![\w-])|(?<![\w-])color:\s*rgb\(var\(--color-ink-300\)/g,
    bad: ['className="text-ink-300"', "hover:text-ink-300", "@apply placeholder-ink-300", "color: rgb(var(--color-ink-300))"],
    good: ['className="text-ink-400"', 'className="fill-ink-300"', "--color-ink-300: 156 158 162;", 'className="border-ink-300x"']
  },
  {
    id: "ink-100-border",
    description: "ink-100 to WYPELNIENIE, nie ramka: karty border-line, kontrolki border-line-strong (WCAG 1.4.11)",
    pattern: /(?<![\w-])(?:border|divide|ring|outline)(?:-[trblxyse])?-ink-100(?![\w-])/g,
    bad: ['className="border border-ink-100"', "divide-y divide-ink-100", "ring-1 ring-ink-100", "border-t-ink-100", "border-b-ink-100"],
    good: ["bg-ink-100", "hover:bg-ink-100", "border-line", "border-line-strong", "dark:ring-line"]
  },
  {
    id: "ink-solid",
    description: "ink-solid to token LEGACY panelu v1 - w kodzie publicznym <Button> lub bg-action text-on-action",
    pattern: /(?<![\w-])(?:bg|text|border|ring|from|to|via|divide)-ink-solid(?![\w-])/g,
    bad: ['className="bg-ink-solid text-white"', "hover:bg-ink-solid"],
    good: ["--color-ink-solid: 26 28 32;", "bg-action text-on-action"]
  },
  {
    id: "pure-white-black",
    description: "text-white/bg-white/text-black ignoruja motyw (psuja ciemny): text-on-action, text-on-coral, bg-surface, bg-logo-tile",
    pattern: /(?<![\w-])(?:text|bg|border|ring|fill|stroke|from|to|via|divide|outline)-(?:white|black)(?![\w-])/g,
    bad: ['className="bg-ink-solid text-white"', "bg-white", "text-black", "bg-black/50", "hover:bg-white"],
    good: ["text-on-action", "bg-surface", "bg-logo-tile", "text-whitespace-x", "whitespace-nowrap"]
  },
  {
    id: "teal-700-fill",
    description: "bg-teal-700 / hover:bg-teal-600|700 to stary przycisk: bg-action i hover:bg-action-hover (lub <Button>)",
    pattern: /(?<![\w-])(?:bg-teal-700|hover:bg-teal-(?:600|700))(?![\w-])/g,
    bad: ['className="bg-teal-700 text-white"', "hover:bg-teal-700", "hover:bg-teal-600"],
    good: ["bg-action hover:bg-action-hover", "bg-teal-600", "bg-teal-100", "text-teal-700"]
  },
  {
    id: "tiny-text",
    description: "tekst mniejszy niz 12 px jest zakazany (text-[10px], text-[11px], font-size < 12px); tresc informacyjna min. 13 px",
    pattern:
      /(?<![\w-])text-\[(?:\d|1[01])(?:\.\d+)?px\]|(?<![\w-])text-\[0?\.(?:[0-6]\d*|7(?:[0-4]\d*)?)rem\]|(?<![\w-])font-size:\s*(?:\d|1[01])(?:\.\d+)?px/g,
    bad: ['className="text-[10px]"', 'className="text-[11px]"', "text-[9px]", "text-[0.6rem]", "text-[0.7rem]", "font-size: 11px;"],
    good: ['className="text-[12px]"', "text-[17px]", "text-[0.75rem]", "text-[0.5em]", "text-[22px]", "font-size: 12px;", "text-xs"],
    exts: [".ts", ".tsx", ".css"]
  },
  {
    id: "nonexistent-scale",
    description: "klasy spoza skali Tailwinda (h-13, min-h-13 ...) nie generuja zadnego CSS - Button size lg to min-h-14",
    pattern: /(?<![\w-])(?:min-|max-)?(?:h|w|size)-(?:13|15|17|18|19|21|22|23)(?![\w.-])/g,
    bad: ['className="h-13"', "min-h-13", "w-15", "size-17"],
    good: ["h-14", "min-h-14", "h-11", "w-12", "h-1.5", "max-w-[68ch]"]
  },
  {
    id: "nonexistent-ink-shade",
    description: "paleta ink ma tylko 900/700/500/400/300/100 (+ solid) - ink-200, ink-600, ink-50 itp. nie istnieja",
    pattern: /(?<![\w-])(?:text|bg|border|ring|fill|stroke|divide|outline|decoration|placeholder|from|to|via|caret|accent)(?:-[trblxyse])?-ink-(?!(?:900|700|500|400|300|100|solid)(?![\w-]))[\w./]+/g,
    bad: ["border-ink-200", "text-ink-600", "bg-ink-50", "hover:bg-ink-800"],
    good: ["text-ink-900", "bg-ink-100", "border-line", "--color-ink-300: 1 2 3;"]
  },
  {
    id: "nonexistent-palette-shade",
    description: "teal ma 700/600/500/100, gold 600/500/100, coral 600/100 (tailwind.config.ts) - inne odcienie nie istnieja",
    pattern:
      /(?<![\w-])(?:text|bg|border|ring|fill|stroke|divide|outline|decoration|from|to|via)(?:-[trblxyse])?-(?:teal-(?!(?:700|600|500|100)(?![\w-]))|gold-(?!(?:600|500|100)(?![\w-]))|coral-(?!(?:600|100)(?![\w-])))\d[\w./]*/g,
    bad: ["bg-teal-50", "text-gold-700", "border-coral-500", "bg-teal-200"],
    good: ["bg-teal-100", "text-gold-600", "border-coral-600", "bg-coral-100/60"]
  },
  {
    id: "off-palette-tailwind-color",
    description: "kolory z domyslnej palety Tailwinda (gray, red, green ...) omijaja tokeny i motyw - uzyj tokenow ze spec. sekcji 2",
    pattern:
      /(?<![\w-])(?:text|bg|border|ring|fill|stroke|divide|outline|decoration|from|to|via|shadow)(?:-[trblxyse])?-(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow|amber|emerald|orange|purple|pink|rose|sky|indigo|cyan|lime|violet|fuchsia)-\d{2,3}(?![\w-])/g,
    bad: ["text-gray-500", "bg-red-50", "border-slate-200", "text-emerald-600"],
    good: ["text-ink-500", "bg-coral-100", "border-line", "text-success"]
  },
  {
    id: "arbitrary-color",
    description: "kolory w nawiasach kwadratowych (bg-[#fff], text-[rgb(...)]) omijaja tokeny i motyw",
    pattern: /(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|divide|outline)(?:-[trblxyse])?-\[(?:#|rgb|hsl)/g,
    bad: ['className="bg-[#fff]"', "text-[rgb(1,2,3)]", "border-[hsl(1,2%,3%)]"],
    good: ["bg-[length:10px]", "text-[17px]", "border-[1.5px]", "shadow-[var(--shadow-pop)]"]
  },
  {
    id: "break-all",
    description: "break-all tnie polskie slowa w srodku (np. w opisach oplat) - break-words; break-all tylko dla golych URL-i",
    pattern: /(?<![\w-])break-all(?![\w-])|word-break:\s*break-all/g,
    bad: ['className="break-all"', "word-break: break-all;"],
    good: ["break-words", "[overflow-wrap:anywhere]", "break-after-all-x"]
  },
  {
    id: "rating-toFixed",
    description: "ocena z kropka: toFixed(1) drukuje „9.4”; oceny zawsze przez formatRating (src/lib/format.ts) -> „9,4”",
    pattern: /\.toFixed\(\s*1\s*\)/g,
    exts: [".ts", ".tsx"],
    exceptions: [
      {
        file: "src/lib/services/analytics.ts",
        reason: "CTR (procent klikniec) w panelu admina jako Number(...) do wykresow - nie jest to ocena serwisu i nie trafia do tekstu strony publicznej"
      }
    ],
    bad: ["rating.toFixed(1)", "Number(x).toFixed( 1 )", "(9.44).toFixed(1)"],
    good: ["formatRating(9.4)", "zloty.toFixed(2)", "x.toFixed(0)"]
  },
  {
    id: "forbidden-animation",
    description: "animate-ping / animate-pulse / animate-bounce, konfetti, iskry, shimmer sa zakazane (spec sekcja 6): statyczna kropka, szkielet z .skeleton",
    pattern: /(?<![\w-])animate-(?:ping|pulse|bounce)(?![\w-])|confetti|firework|PARTICLE_ANGLES|shimmer/gi,
    bad: ['className="animate-ping"', "animate-pulse", "hover:animate-bounce", "launchConfetti()", "earnings-firework", "PARTICLE_ANGLES", "shimmer-sweep"],
    good: ["animate-spin", "animate-fade-in", "skeleton-pulse", "ring-pulse", "Sparkles"]
  },
  {
    id: "forbidden-shadow-and-lift",
    description: "karty bez cieni i bez uniesienia na hover (spec sekcja 1.2, 5): dozwolone tylko shadow-pop i shadow-modal; zakaz shadow-sm|md|lg|xl|2xl|card, hover:shadow, hover:translate, hover:scale",
    pattern: /(?<![\w-])(?:shadow-(?:sm|md|lg|xl|2xl|inner|card|cardHover)|hover:shadow-[\w-]+|hover:-?translate-[xy]-[\w.]+|hover:scale-[\w.]+)(?![\w-])/g,
    bad: ['className="shadow-md"', "shadow-card", "hover:shadow-pop", "hover:-translate-y-0.5", "hover:scale-105", "shadow-cardHover"],
    good: ["shadow-pop", "shadow-modal", "shadow-none", "group-hover:translate-x-0.5", "--shadow-pop: 0 6px;"]
  },
  {
    id: "blur-and-smooth-scroll",
    description: "backdrop-blur i scroll-smooth sa wycofane (naglowek i overlay bez blur, przewijanie sterowane w motion.css z reduced-motion)",
    pattern: /(?<![\w-])(?:backdrop-blur(?:-[\w[\]./]+)?|scroll-smooth)(?![\w-])|backdrop-filter:\s*blur|scroll-behavior:\s*smooth/g,
    bad: ['className="backdrop-blur"', "backdrop-blur-md", "scroll-smooth", "backdrop-filter: blur(4px)", "scroll-behavior: smooth;"],
    good: ["scroll-behavior: auto;", "scroll-pt-20", "scroll-mt-4"]
  },
  {
    id: "disabled-opacity",
    description: "przycisk/pole disabled: bg-ink-100 text-ink-500 border-line, BEZ opacity (opacity zaniza kontrast tekstu)",
    pattern: /(?<![\w-])(?:disabled|aria-disabled|data-\[disabled[^\]]*\]):opacity-\d+(?![\w-])/g,
    bad: ["disabled:opacity-50", "aria-disabled:opacity-60"],
    good: ["disabled:bg-ink-100", "opacity-100", "aria-disabled:bg-ink-100"]
  },
  {
    id: "legacy-fonts",
    description: "Fraunces i IBM Plex Mono sa usuniete (Source Serif 4 + Inter); kody promocyjne: font-mono = ui-monospace",
    pattern: /Fraunces|IBM_Plex|IBM Plex|Plex_Mono/g,
    bad: ['import { Fraunces } from "next/font/google"', "IBM_Plex_Mono(", "font-family: 'IBM Plex Mono'"],
    good: ["Source_Serif_4", "Inter", "font-mono"]
  },
  {
    id: "dangerouslySetInnerHTML",
    description: "dangerouslySetInnerHTML tylko przez <JsonLd> (serializeJsonLd escapuje </script>) lub statyczny skrypt motywu",
    pattern: /dangerouslySetInnerHTML/g,
    exts: [".ts", ".tsx"],
    exceptions: [
      { file: "src/components/JsonLd.tsx", line: /__html:\s*serializeJsonLd\(/, reason: "jedyny dozwolony wrapper JSON-LD: serializeJsonLd zamienia < na \\u003c, wiec dane nie zamkna znacznika script" },
      { file: "src/app/layout.tsx", line: /__html:\s*THEME_INIT_SCRIPT/, reason: "stala, statyczna tresc skryptu motywu/motion-ok w <head> (zadnych danych z bazy ani od uzytkownika)" },
      { file: "src/app/global-error.tsx", line: /__html:\s*THEME_INIT_SCRIPT/, reason: "ta sama stala co w layout.tsx - global-error nie renderuje layoutu, wiec sam ustawia motyw" }
    ],
    bad: ['<div dangerouslySetInnerHTML={{ __html: html }} />', "dangerouslySetInnerHTML"],
    good: ["serializeJsonLd(data)", "<JsonLd data={x} />"]
  },
  {
    id: "site-url-env",
    description: "adres serwisu pobieraj z src/lib/seo/siteUrl.ts (getSiteUrl) - process.env.NEXT_PUBLIC_SITE_URL tylko tam (jedno miejsce z walidacja i fallbackiem)",
    pattern: /process\.env\.NEXT_PUBLIC_SITE_URL/g,
    exts: [".ts", ".tsx"],
    exceptions: [
      { file: "src/lib/seo/", reason: "biblioteka SEO - jedyne zrodlo adresu serwisu (siteUrl.ts) i jej konsumenci" },
      { file: "src/lib/passwordReset.ts", reason: "link w mailu resetu hasla (kod serwerowy, nie renderuje strony); celowy fallback localhost dla dev - poza zakresem redesignu publicznych stron" },
      { file: "src/lib/services/checklistReminders.ts", reason: "link do /konto w mailach przypomnien (kod serwerowy, nie HTML strony)" },
      { file: "src/lib/services/eligibilityNotifications.ts", reason: "link w mailu o spelnieniu karencji (kod serwerowy, nie HTML strony)" },
      { file: "src/app/api/cron/ebroker-watch/route.ts", reason: "alarm eBroker dla admina (pakiet eBroker, poza zakresem redesignu)" }
    ],
    bad: ["const u = process.env.NEXT_PUBLIC_SITE_URL ?? ''"],
    good: ["getSiteUrl()", "NEXT_PUBLIC_SITE_URL is missing"]
  }
];

// ------------------------------------------------------------------ scanner

interface Violation {
  rule: string;
  where: string;
  snippet: string;
}

function exceptionFor(rule: Rule, rel: string, line: string): Exception | undefined {
  return (rule.exceptions ?? []).find((e) => {
    const fileOk = e.file.endsWith("/") ? rel.startsWith(e.file) : rel === e.file;
    return fileOk && (!e.line || e.line.test(line));
  });
}

function scan(rule: Rule): { violations: Violation[]; usedExceptions: Set<Exception> } {
  const violations: Violation[] = [];
  const used = new Set<Exception>();
  for (const file of FILES) {
    if (rule.exts && !rule.exts.includes(file.ext)) continue;
    rule.pattern.lastIndex = 0;
    for (const m of file.text.matchAll(rule.pattern)) {
      const line = lineOf(file.text, m.index ?? 0);
      const text = lineText(file.text, line);
      const exception = exceptionFor(rule, file.rel, text);
      if (exception) {
        used.add(exception);
        continue;
      }
      violations.push({ rule: rule.id, where: `${file.rel}:${line}`, snippet: `${m[0]}  |  ${text}` });
    }
  }
  return { violations, usedExceptions: used };
}

function report(rule: { id: string; description: string }, violations: Violation[]): string {
  return (
    `\n[${rule.id}] ${rule.description}\n` +
    violations.map((v) => `  ${v.where}  ${v.snippet}`).join("\n") +
    "\n  (popraw uzycie albo dodaj udokumentowany wyjatek w tests/ui-tokens.test.ts)\n"
  );
}

// ------------------------------------------------------------------ tests

test("ui-tokens: the scanner sees the public source tree (and not the admin panel)", () => {
  assert.ok(FILES.length > 150, `expected > 150 files in src, got ${FILES.length}`);
  assert.ok(FILES.some((f) => f.rel === "src/app/globals.css"));
  assert.ok(FILES.some((f) => f.rel === "src/components/Header.tsx"));
  assert.ok(!FILES.some((f) => f.rel.startsWith("src/app/admin/")));
  assert.ok(!FILES.some((f) => /\.test\./.test(f.rel)));
});

test("ui-tokens: comment stripping keeps line numbers and hides documented mentions", () => {
  const src = 'a /* text-ink-300\n still comment */ b\nconst u = "https://x.pl"; // text-ink-300\nclassName="text-ink-300"';
  const out = stripComments(src, ".tsx");
  assert.equal(out.split("\n").length, src.split("\n").length);
  assert.match(out, /https:\/\/x\.pl/);
  assert.equal((out.match(/text-ink-300/g) ?? []).length, 1);
  assert.equal(lineOf(out, out.indexOf("text-ink-300")), 4);
});

for (const rule of RULES) {
  test(`ui-tokens [${rule.id}]: self-check of the rule`, () => {
    for (const sample of rule.bad) {
      rule.pattern.lastIndex = 0;
      assert.ok(rule.pattern.test(sample), `the rule must flag: ${sample}`);
    }
    for (const sample of rule.good) {
      rule.pattern.lastIndex = 0;
      assert.ok(!rule.pattern.test(sample), `the rule must NOT flag: ${sample}`);
    }
    for (const e of rule.exceptions ?? []) assert.ok(e.reason.length > 20, `exception ${e.file} needs a real reason`);
  });

  test(`ui-tokens [${rule.id}]: no forbidden use in src`, () => {
    const { violations, usedExceptions } = scan(rule);
    assert.equal(violations.length, 0, report(rule, violations));
    for (const e of rule.exceptions ?? []) {
      assert.ok(usedExceptions.has(e), `[${rule.id}] exception for ${e.file} is stale (no longer needed) - remove it`);
    }
  });
}

// ------------------------------------------------------------------ combinations inside one class string

interface Combo {
  id: string;
  description: string;
  /** a string literal that matches ALL of these is a violation */
  all: RegExp[];
  bad: string;
  good: string;
}

const COMBOS: Combo[] = [
  {
    id: "ink-400-on-ink-100",
    description: "text-ink-400 na tle ink-100 ma tylko 4,39:1 (< 4,5) - na ink-100 uzyj text-ink-500 lub ink-700",
    all: [/(?<![\w-])bg-ink-100(?![\w-])/, /(?<![\w-])text-ink-400(?![\w-])/],
    bad: "bg-ink-100 text-ink-400 px-2",
    good: "bg-ink-100 text-ink-500 px-2"
  },
  {
    id: "teal-600-text-on-tint",
    description: "text-teal-600 na tle teal-100 ma tylko 4,38:1 - tekst na tincie zawsze text-teal-700 (lub ink-900)",
    all: [/(?<![\w-])bg-teal-100(?:\/\d+)?(?![\w-])/, /(?<![\w-])text-teal-600(?![\w-])/],
    bad: "bg-teal-100 text-teal-600",
    good: "bg-teal-100 text-teal-700"
  },
  {
    id: "gold-500-text-on-tint",
    description: "text-gold-500 to kolor wypelnien/ikon - tekst na gold-100 to text-gold-600",
    all: [/(?<![\w-])bg-gold-100(?![\w-])/, /(?<![\w-])text-gold-500(?![\w-])/],
    bad: "bg-gold-100 text-gold-500",
    good: "bg-gold-100 text-gold-600"
  },
  {
    id: "action-fill-with-wrong-text",
    description: "wypelnienie teal-600/700 z tekstem white/on-action - przycisk to <Button> lub bg-action text-on-action",
    all: [/(?<![\w-])bg-teal-(?:600|700)(?![\w-])/, /(?<![\w-])text-(?:white|on-action)(?![\w-])/],
    bad: "bg-teal-600 text-white",
    good: "bg-action text-on-action"
  },
  {
    id: "ink-100-fill-with-ink-300-text",
    description: "text-ink-300 (dekoracja) na jakimkolwiek wypelnieniu = nieczytelny tekst",
    all: [/(?<![\w-])bg-(?:ink-100|sunken|surface|paper)(?![\w-])/, /(?<![\w-])text-ink-300(?![\w-])/],
    bad: "bg-sunken text-ink-300",
    good: "bg-sunken text-ink-500"
  }
];

/** Quoted string / template literals of a source file (rough, but enough for className strings). */
function stringLiterals(text: string): Array<{ value: string; index: number }> {
  const out: Array<{ value: string; index: number }> = [];
  for (const m of text.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
    out.push({ value: m[1] ?? m[2] ?? m[3] ?? "", index: m.index ?? 0 });
  }
  return out;
}

for (const combo of COMBOS) {
  test(`ui-tokens combo [${combo.id}]: self-check`, () => {
    assert.ok(combo.all.every((re) => re.test(combo.bad)), `bad sample must trip: ${combo.bad}`);
    assert.ok(!combo.all.every((re) => re.test(combo.good)), `good sample must pass: ${combo.good}`);
  });

  test(`ui-tokens combo [${combo.id}]: no class string combines them`, () => {
    const violations: Violation[] = [];
    for (const file of FILES) {
      if (file.ext === ".css") continue;
      for (const lit of stringLiterals(file.text)) {
        if (combo.all.every((re) => re.test(lit.value))) {
          violations.push({ rule: combo.id, where: `${file.rel}:${lineOf(file.text, lit.index)}`, snippet: lit.value.slice(0, 140) });
        }
      }
    }
    assert.equal(violations.length, 0, report(combo, violations));
  });
}

// ------------------------------------------------------------------ target="_blank" needs rel="noopener"

/** The JSX opening tag that contains the character at `index`: from the preceding `<Tag` to its closing `>`. */
function enclosingTag(text: string, index: number): string {
  let start = index;
  while (start > 0 && !(text[start] === "<" && /[A-Za-z]/.test(text[start + 1] ?? ""))) start--;
  let depth = 0;
  let end = start;
  for (; end < text.length; end++) {
    const ch = text[end];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0 && text[end - 1] !== "=") break;
  }
  return text.slice(start, end + 1);
}

function relHasNoopener(tag: string, fileText: string): boolean {
  const literal = tag.match(/\brel=(?:"([^"]*)"|\{\s*["'`]([^"'`]*)["'`]\s*\})/);
  if (literal) return /\bnoopener\b/.test(literal[1] ?? literal[2] ?? "");
  const ident = tag.match(/\brel=\{\s*([A-Za-z_$][\w$]*)\s*\}/);
  if (ident) {
    const decl = fileText.match(new RegExp(`(?:const|let)\\s+${ident[1]!.replace(/\$/g, "\\$")}\\s*(?::[^=]+)?=\\s*["'\`]([^"'\`]*)["'\`]`));
    return Boolean(decl && /\bnoopener\b/.test(decl[1]!));
  }
  return false;
}

function targetBlankViolations(files: Array<{ rel: string; text: string }>): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    for (const m of file.text.matchAll(/\btarget=(?:"_blank"|\{\s*["'`]_blank["'`]\s*\})/g)) {
      const tag = enclosingTag(file.text, m.index ?? 0);
      if (!relHasNoopener(tag, file.text)) {
        out.push({
          rule: "target-blank-rel",
          where: `${file.rel}:${lineOf(file.text, m.index ?? 0)}`,
          snippet: tag.replace(/\s+/g, " ").slice(0, 140)
        });
      }
    }
  }
  return out;
}

test('ui-tokens [target-blank-rel]: self-check of the checker', () => {
  const sample = (s: string) => targetBlankViolations([{ rel: "x.tsx", text: s }]).length;
  assert.equal(sample('<a href="/x" target="_blank">x</a>'), 1);
  assert.equal(sample('<a href="/x" target="_blank" rel="nofollow">x</a>'), 1);
  assert.equal(sample('<a href="/x" target="_blank" rel="noopener noreferrer">x</a>'), 0);
  assert.equal(sample('<Link href="/x" target="_blank" rel="noopener" className="a">x</Link>'), 0);
  assert.equal(sample('<a\n  href={u}\n  target="_blank"\n  rel="noopener noreferrer nofollow"\n>x</a>'), 0);
  assert.equal(sample('const REL = "sponsored noopener";\n<a target="_blank" rel={REL}>x</a>'), 0);
  assert.equal(sample('const REL = "nofollow";\n<a target="_blank" rel={REL}>x</a>'), 1);
  assert.equal(sample('<a target="_blank" rel={cond ? "noopener" : undefined}>x</a>'), 1);
});

test('ui-tokens [target-blank-rel]: every target="_blank" has rel containing noopener', () => {
  const violations = targetBlankViolations(FILES.filter((f) => f.ext !== ".css"));
  assert.equal(
    violations.length,
    0,
    report({ id: "target-blank-rel", description: 'target="_blank" bez rel="noopener" pozwala otwartej stronie sterowac window.opener (tabnabbing)' }, violations)
  );
});
