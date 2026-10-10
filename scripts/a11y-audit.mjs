#!/usr/bin/env node
/**
 * Accessibility audit of the public pages of Bankmiplaci (redesign v2).
 * Report and method: docs/redesign-v2/07-a11y-audit.md.
 *
 * Runs against an ALREADY RUNNING server (dev or production), one page after
 * another (never in parallel), in headless Chromium from @playwright/test:
 *
 *   --axe     (default) axe-core (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa,
 *             best-practice) on every page x width x theme, plus: no horizontal
 *             scroll and no console errors.
 *   --manual  the checks axe cannot do: keyboard order and focus traps (home,
 *             mobile menu, filter sheet, sign-in dialog), visible focus ring
 *             (contrast >= 3:1), prefers-reduced-motion, zoom 200 % / 400 %,
 *             touch target size (24 px, 44 px for the main CTAs on mobile).
 *   --all     both.
 *
 * Only reads: it does not log in, submit forms or write anything (the only
 * file it writes is the JSON report).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

const HELP = `
Uzycie:  node scripts/a11y-audit.mjs [opcje]      (npm run audit:a11y -- [opcje])

Audyt dostepnosci publicznych stron na DZIALAJACYM serwerze (domyslnie
http://localhost:3000). Strony sprawdzane po kolei, nie rownolegle.

Tryby (domyslnie --axe):
  --axe            axe-core na kazdej stronie x szerokosc x motyw + brak poziomego
                   scrolla + brak bledow konsoli
  --manual         kontrole reczne: klawiatura i pulapki fokusu, widoczny fokus,
                   prefers-reduced-motion, zoom 200%/400%, rozmiar celow dotyku
  --all            oba tryby

Opcje:
  --base URL       adres serwera (domyslnie $BASE_URL albo http://localhost:3000)
  --out PLIK       plik raportu JSON (domyslnie <tmp>/bankmiplaci-a11y/a11y-<czas>.json)
  --only A,B       tylko strony, ktorych sciezka zawiera ktorys z fragmentow
  --widths 360,1280  szerokosci viewportu (domyslnie 360,1280)
  --themes light,dark  motywy (domyslnie light,dark)
  --offer SLUG     aktywna oferta   (domyslnie pierwsza z /sitemap.xml)
  --expired SLUG   oferta zakonczona (domyslnie pekao-promocja-podrozna; gdy 404 - pomijana)
  --bank SLUG      strona banku     (domyslnie pko)
  --fail-on LISTA  poziomy axe powodujace kod wyjscia 1 (domyslnie critical,serious)
  --timeout MS     limit czasu jednej nawigacji (domyslnie 90000; dev-serwer bywa wolny)
  --verbose        wypisz kazdy wezel naruszenia (domyslnie: pierwsze 3 na regule)
  --headed         pokaz okno przegladarki
  --help           ta pomoc

Kod wyjscia: 0 = brak naruszen na wybranych poziomach, brak poziomego scrolla,
brak bledow konsoli i brak niepowodzen kontroli recznych; 1 = jest cos z tej
listy; 2 = blad uruchomienia (serwer niedostepny, brak przegladarki).
Overlay dev-serwera Next (przycisk "N", <nextjs-portal>) jest wylaczony z axe.
`;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    base: process.env.BASE_URL || "http://localhost:3000",
    out: null,
    only: [],
    widths: [360, 1280],
    themes: ["light", "dark"],
    offer: null,
    expired: "pekao-promocja-podrozna",
    bank: "pko",
    failOn: ["critical", "serious"],
    timeout: 90000,
    verbose: false,
    headed: false,
    axe: false,
    manual: false
  };
  const takes = new Set(["--base", "--out", "--only", "--widths", "--themes", "--offer", "--expired", "--bank", "--fail-on", "--timeout"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (a === "--verbose") opts.verbose = true;
    else if (a === "--headed") opts.headed = true;
    else if (a === "--axe") opts.axe = true;
    else if (a === "--manual") opts.manual = true;
    else if (a === "--all") opts.axe = opts.manual = true;
    else if (takes.has(a)) {
      const v = argv[++i];
      if (v === undefined) die(`Brak wartosci dla ${a}`);
      if (a === "--base") opts.base = v.replace(/\/+$/, "");
      if (a === "--out") opts.out = v;
      if (a === "--only") opts.only = v.split(",").filter(Boolean);
      if (a === "--widths") opts.widths = v.split(",").map(Number).filter((n) => n > 0);
      if (a === "--themes") opts.themes = v.split(",").filter((t) => t === "light" || t === "dark");
      if (a === "--offer") opts.offer = v;
      if (a === "--expired") opts.expired = v;
      if (a === "--bank") opts.bank = v;
      if (a === "--fail-on") opts.failOn = v.split(",").filter(Boolean);
      if (a === "--timeout") opts.timeout = Number(v) || 90000;
    } else die(`Nieznana opcja: ${a} (--help)`);
  }
  if (!opts.axe && !opts.manual) opts.axe = true;
  if (!opts.out) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    opts.out = path.join(os.tmpdir(), "bankmiplaci-a11y", `a11y-${stamp}.json`);
  }
  return opts;
}

function die(message, code = 2) {
  console.error(message);
  process.exit(code);
}

const opts = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let chromium;
try {
  ({ chromium } = require("@playwright/test"));
} catch {
  die("Brak @playwright/test w node_modules (npm install).");
}
let axeSource;
try {
  axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
} catch {
  die("Brak axe-core w node_modules (npm install).");
}

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
// Next dev overlay (button "N", error portal) is not site code.
const AXE_EXCLUDE = [["nextjs-portal"], ["#__next-build-watcher"], ["[data-nextjs-toast]"]];
const IMPACTS = ["critical", "serious", "moderate", "minor"];
const NOISE = [/\[HMR\]/i, /Download the React DevTools/i, /Fast Refresh/i, /\[Fast Refresh\]/i];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function discoverFromSitemap() {
  try {
    const res = await fetch(`${opts.base}/sitemap.xml`, { signal: AbortSignal.timeout(opts.timeout) });
    const xml = await res.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, ""));
  } catch {
    return [];
  }
}

async function buildPages() {
  const sitemap = await discoverFromSitemap();
  const offer =
    opts.offer ||
    (sitemap.find((p) => /^\/promocje\/[^/]+$/.test(p) && p !== "/promocje/konczace-sie") || "").replace("/promocje/", "") ||
    null;
  const pages = [
    { path: "/" },
    { path: "/promocje" },
    { path: "/promocje/konczace-sie" },
    { path: "/konta-osobiste-z-premia" },
    { path: "/konta-firmowe-z-premia" },
    { path: "/banki" },
    { path: `/banki/${opts.bank}` },
    { path: "/porownaj" },
    { path: "/quiz" },
    { path: "/blog" },
    { path: "/blog/kategoria/poradniki", note: "kategoria bloga (pusta)" },
    { path: "/jak-to-dziala" },
    { path: "/faq" },
    { path: "/jak-zarabiamy" },
    { path: "/metodologia" },
    { path: "/o-nas" },
    { path: "/kontakt" },
    { path: "/regulamin" },
    { path: "/polityka-prywatnosci" },
    { path: "/cookies" },
    { path: "/konto/logowanie" },
    { path: "/konto/rejestracja" },
    { path: "/konto/zapomniane-haslo" },
    { path: "/konto/reset-hasla" },
    { path: "/konto", note: "bez sesji: przekierowanie do logowania" },
    { path: "/nie-ma-takiej-strony", expect404: true, note: "strona 404" }
  ];
  if (offer) pages.splice(2, 0, { path: `/promocje/${offer}`, note: "oferta aktywna" });
  if (opts.expired) pages.splice(3, 0, { path: `/promocje/${opts.expired}`, note: "oferta zakonczona", optional: true });
  return opts.only.length ? pages.filter((p) => opts.only.some((o) => p.path.includes(o))) : pages;
}

async function newContext(browser, { width, height, theme, reducedMotion }) {
  const context = await browser.newContext({
    viewport: { width, height: height ?? (width < 700 ? 780 : 900) },
    locale: "pl-PL",
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    colorScheme: theme === "dark" ? "dark" : "light"
  });
  // The site's theme comes from localStorage.theme (prefers-color-scheme alone does not switch it).
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
  context.setDefaultTimeout(opts.timeout);
  context.setDefaultNavigationTimeout(opts.timeout);
  return context;
}

/** Loads a page and waits for it to settle; returns { status, finalUrl, consoleErrors }. */
async function openPage(context, url, { scroll = true } = {}) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (NOISE.some((re) => re.test(text))) return;
    consoleErrors.push({ text: text.slice(0, 300), url: m.location()?.url ?? "" });
  });
  page.on("pageerror", (e) => consoleErrors.push({ text: `pageerror: ${String(e.message).slice(0, 300)}`, url: "" }));
  // The dev server sometimes stalls for a moment (recompiling, restarting): one retry.
  let response;
  try {
    response = await page.goto(url, { waitUntil: "load", timeout: opts.timeout });
  } catch (error) {
    if (!/Timeout/i.test(String(error?.message))) throw error;
    response = await page.goto(url, { waitUntil: "load", timeout: opts.timeout });
  }
  await page.waitForTimeout(1500);
  if (scroll) await scrollThrough(page);
  return { page, status: response?.status() ?? 0, finalUrl: page.url(), consoleErrors };
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.round(window.innerHeight * 0.7));
    const total = document.documentElement.scrollHeight;
    for (let y = 0, n = 0; y < total && n < 60; y += step, n++) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 200));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
}

const hasHScroll = (page) =>
  page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, innerWidth: window.innerWidth, over: el.scrollWidth > window.innerWidth + 1 };
  });

// ---------------------------------------------------------------------------
// Part 1: axe
// ---------------------------------------------------------------------------

async function runAxe(browser, pages) {
  const results = [];
  for (const theme of opts.themes) {
    for (const width of opts.widths) {
      const context = await newContext(browser, { width, theme });
      for (const entry of pages) {
        const row = { path: entry.path, width, theme, note: entry.note ?? "" };
        try {
          const { page, status, finalUrl, consoleErrors } = await openPage(context, opts.base + entry.path);
          row.status = status;
          row.finalPath = finalUrl.replace(opts.base, "");
          if (entry.optional && status === 404) {
            row.skipped = "404 (oferta nie istnieje w bazie)";
            await page.close();
            results.push(row);
            continue;
          }
          row.statusOk = entry.expect404 ? status === 404 : status >= 200 && status < 400;
          await page.evaluate(axeSource);
          const axe = await page.evaluate(
            async ({ tags, exclude }) =>
              // eslint-disable-next-line no-undef
              await axe.run({ exclude }, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations", "incomplete", "passes"] }),
            { tags: AXE_TAGS, exclude: AXE_EXCLUDE }
          );
          row.violations = axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => ({ target: n.target.join(" >> "), html: n.html.slice(0, 200), summary: (n.failureSummary || "").split("\n").slice(1, 3).join(" ").slice(0, 240) }))
          }));
          row.rulesPassed = axe.passes.length;
          row.incomplete = axe.incomplete.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length, first: v.nodes[0]?.target.join(" >> ") }));
          row.counts = Object.fromEntries(IMPACTS.map((i) => [i, axe.violations.filter((v) => v.impact === i).reduce((s, v) => s + v.nodes.length, 0)]));
          row.hscroll = await hasHScroll(page);
          // The 404 page logs one expected "Failed to load resource ... 404" for the document itself.
          row.consoleErrors = entry.expect404 ? consoleErrors.filter((e) => !/status of 404/.test(e.text)) : consoleErrors;
          await page.close();
        } catch (error) {
          row.error = String(error?.message ?? error).split("\n")[0];
        }
        results.push(row);
        console.log(formatRow(row));
      }
      await context.close();
    }
  }
  return results;
}

function formatRow(r) {
  const cell = (s, n) => String(s).padEnd(n).slice(0, n);
  if (r.error) return `${cell(r.path, 52)} ${cell(r.width, 5)} ${cell(r.theme, 5)} BLAD: ${r.error}`;
  if (r.skipped) return `${cell(r.path, 52)} ${cell(r.width, 5)} ${cell(r.theme, 5)} pominieto: ${r.skipped}`;
  const c = r.counts;
  const ce = r.consoleErrors.length;
  return (
    `${cell(r.path, 52)} ${cell(r.width, 5)} ${cell(r.theme, 5)} ${cell(r.status + (r.statusOk ? "" : "!"), 5)}` +
    ` crit ${c.critical} serious ${c.serious} moder ${c.moderate} minor ${c.minor}` +
    ` | hscroll ${r.hscroll.over ? `TAK (${r.hscroll.scrollWidth}>${r.hscroll.innerWidth})` : "nie"} | konsola ${ce} | reguly ok ${r.rulesPassed} niejasne ${r.incomplete.length}`
  );
}

function summariseAxe(results) {
  const failLevels = new Set(opts.failOn);
  let failed = false;
  const totals = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
  const byRule = new Map();
  for (const r of results) {
    if (r.error || r.skipped) {
      if (r.error) failed = true;
      continue;
    }
    if (!r.statusOk) failed = true;
    if (r.hscroll.over || r.consoleErrors.length) failed = true;
    for (const i of IMPACTS) totals[i] += r.counts[i];
    for (const v of r.violations) {
      const key = `${v.impact}|${v.id}`;
      const entry = byRule.get(key) ?? { impact: v.impact, id: v.id, help: v.help, nodes: 0, runs: new Set(), samples: [] };
      entry.nodes += v.nodes.length;
      entry.runs.add(`${r.path} ${r.width}px ${r.theme}`);
      for (const n of v.nodes) if (entry.samples.length < (opts.verbose ? 50 : 3)) entry.samples.push({ run: `${r.path} ${r.width}px ${r.theme}`, ...n });
      byRule.set(key, entry);
      if (failLevels.has(v.impact)) failed = true;
    }
  }
  console.log("\n=== Podsumowanie axe ===");
  console.log(`Przebiegi: ${results.length}  | wezly naruszen: critical ${totals.critical}, serious ${totals.serious}, moderate ${totals.moderate}, minor ${totals.minor}`);
  const rules = [...byRule.values()].sort((a, b) => IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact) || b.nodes - a.nodes);
  for (const rule of rules) {
    console.log(`\n[${rule.impact}] ${rule.id} - ${rule.help}  (${rule.nodes} wezlow w ${rule.runs.size} przebiegach)`);
    for (const s of rule.samples) console.log(`   - ${s.run}\n     ${s.target}\n     ${s.html.replace(/\s+/g, " ")}\n     ${s.summary}`);
  }
  const bad = results.filter((r) => !r.error && !r.skipped && (!r.statusOk || r.hscroll.over || r.consoleErrors.length));
  if (bad.length) {
    console.log("\n=== Poziomy scroll / konsola / status ===");
    for (const r of bad) {
      if (!r.statusOk) console.log(`- ${r.path} ${r.width}px ${r.theme}: nieoczekiwany status ${r.status}`);
      if (r.hscroll.over) console.log(`- ${r.path} ${r.width}px ${r.theme}: poziomy scroll ${r.hscroll.scrollWidth} > ${r.hscroll.innerWidth}`);
      for (const e of r.consoleErrors) console.log(`- ${r.path} ${r.width}px ${r.theme}: konsola: ${e.text}`);
    }
  }
  for (const r of results.filter((x) => x.error)) console.log(`- BLAD ${r.path} ${r.width}px ${r.theme}: ${r.error}`);
  return { failed, totals };
}

// ---------------------------------------------------------------------------
// Part 2: manual checks
// ---------------------------------------------------------------------------

/** Helpers injected into the page (colour parsing, contrast, element description). */
const PAGE_HELPERS = `
(() => {
  if (window.__a11y) return;
  const parse = (value) => {
    const m = String(value).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (t, b) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  // Effective background colour behind an element: composite the backgrounds of its ancestors.
  const backdrop = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    const html = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (html && html.a > 0) acc = over(html, acc);
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };
  const describe = (el) => {
    if (!el || el === document.body) return "(body)";
    const tag = el.tagName.toLowerCase();
    const name = (el.getAttribute("aria-label") || el.innerText || el.value || el.getAttribute("title") || el.getAttribute("placeholder") || "").trim().replace(/\\s+/g, " ").slice(0, 40);
    const href = el.getAttribute("href");
    return tag + (el.id ? "#" + el.id : "") + (href ? "[" + href.slice(0, 40) + "]" : "") + (name ? ' "' + name + '"' : "");
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  };
  window.__a11y = { parse, over, ratio, backdrop, describe, visible };
})();
`;

const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"]';

function recordCheck(report, group, name, ok, detail) {
  report.push({ group, name, ok, detail });
  console.log(`  ${ok === true ? "OK   " : ok === false ? "BLAD " : "UWAGA"} ${name}${detail ? " - " + detail : ""}`);
}

async function tabStops(page, count) {
  const stops = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      const h = window.__a11y;
      if (!el || el === document.body) return { body: true };
      if (el.tagName === "NEXTJS-PORTAL") return { devOverlay: true, desc: "nextjs-portal", top: 0, left: 0 };
      const r = el.getBoundingClientRect();
      return {
        desc: h.describe(el),
        top: Math.round(r.top + window.scrollY),
        left: Math.round(r.left + window.scrollX),
        hiddenByAria: !!el.closest('[aria-hidden="true"]'),
        inert: !!el.closest("[inert]"),
        visible: h.visible(el),
        inViewport: r.bottom > 0 && r.top < window.innerHeight
      };
    });
    stops.push(info);
    if (info.body) break;
  }
  return stops;
}

async function manualKeyboard(browser, report, offerPath) {
  console.log("\n[a] Klawiatura");
  // --- home, desktop
  let context = await newContext(browser, { width: 1280, theme: "light" });
  let { page } = await openPage(context, opts.base + "/", { scroll: false });
  await page.evaluate(PAGE_HELPERS);
  const stops = await tabStops(page, 45);
  const names = stops.filter((s) => !s.body && !s.devOverlay).map((s) => s.desc);
  recordCheck(report, "keyboard", "Strona glowna 1280: pierwszy Tab = link 'Przejdz do tresci'", /Przejd/.test(names[0] ?? ""), names[0]);
  const bad = stops.filter((s) => !s.body && !s.devOverlay && (s.hiddenByAria || s.inert || !s.visible));
  recordCheck(report, "keyboard", "Strona glowna 1280: fokus nigdy nie trafia na element ukryty/inert/aria-hidden", bad.length === 0, bad.map((s) => s.desc).join("; "));
  const back = [];
  // A jump UP is fine when it is a move to the next column of a grid (to the right of the previous stop);
  // it is a finding when focus goes up and not to the right (or left/back to an earlier block).
  let prev = null;
  stops.forEach((s, i) => {
    if (s.body || s.devOverlay) return;
    if (i > 0 && prev && s.top < prev.top - 80 && !(s.left > prev.left + 60)) back.push(`${s.desc} (y=${s.top} po y=${prev.top})`);
    prev = s;
  });
  recordCheck(report, "keyboard", "Strona glowna 1280: kolejnosc Tab zgodna z wizualna (brak skokow wstecz > 80 px poza przejsciem do kolejnej kolumny siatki)", back.length === 0, back.slice(0, 5).join("; "));
  report.push({ group: "keyboard", name: "Kolejnosc Tab strony glownej (pierwsze 45 przystankow)", ok: true, detail: names.join(" | ") });
  console.log("  kolejnosc: " + names.slice(0, 16).join(" | ") + " ...");
  await context.close();

  // --- mobile menu
  context = await newContext(browser, { width: 360, theme: "light" });
  ({ page } = await openPage(context, opts.base + "/", { scroll: false }));
  await page.evaluate(PAGE_HELPERS);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  // Keyboard path to the hamburger: Tab until it has focus.
  let reached = false;
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Menu");
  }
  recordCheck(report, "keyboard", "Menu mobilne 360: przycisk Menu osiagalny klawiatura", reached);
  if (reached) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const expanded = await menu.getAttribute("aria-expanded");
    recordCheck(report, "keyboard", "Menu mobilne: Enter otwiera (aria-expanded=true)", expanded === "true", `aria-expanded=${expanded}`);
    const seen = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const d = await page.evaluate(() => ({ desc: window.__a11y.describe(document.activeElement), inNav: !!document.activeElement?.closest('nav[aria-label="Menu mobilne"]'), isBtn: document.activeElement?.getAttribute("aria-label") === "Menu" }));
      seen.push(d);
      if (!d.inNav) break;
    }
    const inNav = seen.filter((s) => s.inNav);
    recordCheck(report, "keyboard", "Menu mobilne: Tab przechodzi po pozycjach menu", inNav.length >= 4, inNav.map((s) => s.desc).join(" | "));
    const stillOpen = await menu.getAttribute("aria-expanded");
    recordCheck(report, "keyboard", "Menu mobilne: Tab poza ostatnia pozycje zamyka menu (bez pulapki)", stillOpen === "false", `aria-expanded=${stillOpen}, fokus na: ${seen[seen.length - 1]?.desc}`);
    // Reopen, Esc closes and returns focus to the button.
    await menu.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ exp: document.querySelector('[aria-label="Menu"]')?.getAttribute("aria-expanded"), onBtn: document.activeElement?.getAttribute("aria-label") === "Menu" }));
    recordCheck(report, "keyboard", "Menu mobilne: Esc zamyka i oddaje fokus przyciskowi", after.exp === "false" && after.onBtn, JSON.stringify(after));
    const inertClosed = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Menu mobilne"]');
      return !!nav?.closest("[inert]");
    });
    recordCheck(report, "keyboard", "Menu mobilne: zamkniete jest inert (linki poza kolejnoscia Tab)", inertClosed);
  }
  await context.close();

  // --- filter sheet (mobile)
  context = await newContext(browser, { width: 360, theme: "light" });
  ({ page } = await openPage(context, opts.base + "/promocje", { scroll: false }));
  await page.evaluate(PAGE_HELPERS);
  await trapCheck(page, report, "Arkusz filtrow 360", page.getByRole("button", { name: /^Filtry/ }).first(), "dialog[open]");
  await context.close();

  // --- sign-in dialog (desktop)
  context = await newContext(browser, { width: 1280, theme: "light" });
  ({ page } = await openPage(context, opts.base + "/", { scroll: false }));
  await page.evaluate(PAGE_HELPERS);
  await trapCheck(page, report, "Modal logowania 1280", page.getByRole("button", { name: /Zaloguj/ }).first(), "dialog[open]");
  await context.close();
  void offerPath;
}

/** Opens a native modal via `opener` and checks the focus trap, Esc and focus return. */
async function trapCheck(page, report, label, opener, dialogSelector) {
  if (!(await opener.count())) return recordCheck(report, "keyboard", `${label}: przycisk otwierajacy`, false, "nie znaleziono");
  await opener.focus();
  const openerDesc = await page.evaluate(() => window.__a11y.describe(document.activeElement));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  const opened = await page.locator(dialogSelector).count();
  recordCheck(report, "keyboard", `${label}: Enter na przycisku otwiera dialog`, opened > 0);
  if (!opened) return;
  const firstFocus = await page.evaluate(() => ({ inside: !!document.activeElement?.closest("dialog"), desc: window.__a11y.describe(document.activeElement) }));
  recordCheck(report, "keyboard", `${label}: fokus wewnatrz dialogu po otwarciu`, firstFocus.inside, firstFocus.desc);
  let escaped = 0;
  let bodyHits = 0;
  const visited = new Set();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press(i < 24 ? "Tab" : "Shift+Tab");
    const s = await page.evaluate(() => ({ body: document.activeElement === document.body || !document.activeElement, inside: !!document.activeElement?.closest("dialog"), desc: window.__a11y.describe(document.activeElement) }));
    if (s.body) bodyHits++;
    else if (!s.inside) escaped++;
    else visited.add(s.desc);
  }
  recordCheck(report, "keyboard", `${label}: pulapka fokusu - 30 naciskniec Tab/Shift+Tab, zadnego wyjscia na strone pod spodem`, escaped === 0, `poza dialogiem: ${escaped}, na body/UI przegladarki: ${bodyHits} (natywny <dialog> moze oddac fokus UI przegladarki), unikalnych celow: ${visited.size}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const closed = (await page.locator(dialogSelector).count()) === 0;
  recordCheck(report, "keyboard", `${label}: Esc zamyka dialog`, closed);
  const back = await page.evaluate(() => window.__a11y.describe(document.activeElement));
  recordCheck(report, "keyboard", `${label}: po zamknieciu fokus wraca na przycisk otwierajacy`, back === openerDesc, `oczekiwano ${openerDesc}, jest ${back}`);
}

async function manualFocusVisible(browser, report, offerPath) {
  console.log("\n[b] Widoczny fokus (kontrast wskaznika >= 3:1)");
  const targets = ["/", "/promocje", offerPath, "/porownaj", "/quiz", "/konto/logowanie", "/faq"].filter(Boolean);
  for (const theme of ["light", "dark"]) {
    for (const width of [1280, 360]) {
      const context = await newContext(browser, { width, theme });
      let total = 0;
      const failures = [];
      const worst = { ratio: 99, desc: "" };
      for (const p of targets) {
        const { page } = await openPage(context, opts.base + p, { scroll: false });
        await page.evaluate(PAGE_HELPERS);
        const limit = p === "/" ? 70 : 45;
        const seen = new Set();
        for (let i = 0; i < limit; i++) {
          await page.keyboard.press("Tab");
          const r = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return { body: true };
            if (el.tagName === "NEXTJS-PORTAL") return { skip: true };
            const h = window.__a11y;
            const key = h.describe(el) + "@" + Math.round(el.getBoundingClientRect().top + scrollY);
            // The ring can live on the element or on a pseudo-element (stretched card links draw it on ::after).
            let found = null;
            for (const pseudo of [null, "::after", "::before"]) {
              const s = getComputedStyle(el, pseudo);
              if (pseudo && s.content === "none") continue;
              const oc = h.parse(s.outlineColor);
              if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && oc && oc.a > 0) {
                found = { color: oc, width: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset) || 0, style: `outline ${s.outlineStyle} ${s.outlineWidth}${pseudo ?? ""}` };
                break;
              }
              // Ring drawn with box-shadow (Tailwind ring-*): first shadow with a non-zero spread and no blur.
              const shadows = s.boxShadow === "none" ? [] : s.boxShadow.match(/rgba?\([^)]*\)[^,]*/g) || [];
              for (const sh of shadows) {
                const color = h.parse(sh);
                const nums = sh.replace(/rgba?\([^)]*\)/, "").trim().split(/\s+/).map(parseFloat);
                if (color && color.a > 0 && nums.length >= 4 && nums[3] > 0 && nums[2] === 0) { found = { color, width: nums[3], offset: 0, style: `ring ${nums[3]}px${pseudo ?? ""}` }; break; }
              }
              if (found) break;
            }
            const color = found ? found.color : null;
            const width = found ? found.width : 0;
            const parentBg = h.backdrop(el.parentElement || el);
            const ownBg = h.backdrop(el);
            const against = !found || found.offset >= 0 ? parentBg : ownBg;
            let contrast = null;
            if (color) {
              const solid = color.a < 1 ? h.over(color, against) : color;
              contrast = Math.round(h.ratio(solid, against) * 100) / 100;
            }
            // Text fields signal focus with a border that turns to the action colour (plus a soft ring): the
            // border of a focused field has to reach 3:1 against the surrounding page (WCAG 1.4.11).
            let borderContrast = null;
            if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
              const s = getComputedStyle(el);
              const bc = h.parse(s.borderTopColor);
              if (bc && parseFloat(s.borderTopWidth) > 0) borderContrast = Math.round(h.ratio(h.over(bc, parentBg), parentBg) * 100) / 100;
            }
            return { key, desc: h.describe(el), hasIndicator: !!color || borderContrast !== null, width: found ? width : 2, contrast: borderContrast !== null && borderContrast >= 3 ? borderContrast : contrast, style: found ? found.style : "brak", borderContrast };
          });
          if (r.body) break;
          if (r.skip) continue;
          if (seen.has(r.key)) continue;
          seen.add(r.key);
          total++;
          if (!r.hasIndicator) failures.push(`${p} ${r.desc}: brak outline/ring`);
          else {
            if (r.contrast < 3) failures.push(`${p} ${r.desc}: kontrast ${r.contrast}:1 (${r.style}${r.borderContrast !== null ? `, ramka ${r.borderContrast}:1` : ""})`);
            if (r.contrast < worst.ratio) { worst.ratio = r.contrast; worst.desc = `${p} ${r.desc}`; }
            if (r.width < 2) failures.push(`${p} ${r.desc}: grubosc ${r.width}px < 2px`);
          }
        }
        await page.close();
      }
      recordCheck(report, "focus", `Fokus ${theme} ${width}px: ${total} elementow, wskaznik >= 2 px i >= 3:1`, failures.length === 0, failures.length ? failures.slice(0, 8).join("; ") : `najslabszy kontrast ${worst.ratio}:1 (${worst.desc})`);
      await context.close();
    }
  }
}

async function manualReducedMotion(browser, report, offerPath) {
  console.log("\n[c] prefers-reduced-motion: reduce");
  const context = await newContext(browser, { width: 1280, theme: "light", reducedMotion: true });
  for (const p of ["/", "/promocje", offerPath, "/porownaj", "/quiz"].filter(Boolean)) {
    const { page } = await openPage(context, opts.base + p, { scroll: false });
    // Immediately after load, before any scrolling: reveal blocks and counters must already be final.
    const state = await page.evaluate(() => {
      const motionOk = document.documentElement.classList.contains("motion-ok");
      const reveal = [...document.querySelectorAll("[data-reveal]")];
      const hiddenReveal = reveal.filter((el) => parseFloat(getComputedStyle(el).opacity) < 1 || getComputedStyle(el).transform !== "none");
      // CountUp markup: .num > span[aria-hidden] + span.sr-only, nothing else inside.
      const counters = [...document.querySelectorAll(".num")].filter((el) => el.children.length === 2 && el.children[0].tagName === "SPAN" && el.children[0].getAttribute("aria-hidden") === "true" && el.children[1].tagName === "SPAN" && el.children[1].classList.contains("sr-only"));
      const wrongCounters = counters.filter((el) => el.querySelector(':scope > [aria-hidden="true"]').textContent.trim() !== el.querySelector(":scope > .sr-only").textContent.trim());
      // Transitions / animations longer than 1 ms that touch transform or opacity.
      const slow = [];
      const ms = (v) => Math.max(0, ...String(v).split(",").map((x) => (x.trim().endsWith("ms") ? parseFloat(x) : parseFloat(x) * 1000) || 0));
      for (const el of document.querySelectorAll("*")) {
        for (const pseudo of [null, "::before", "::after"]) {
          const s = getComputedStyle(el, pseudo);
          if (pseudo && s.content === "none") continue;
          const props = s.transitionProperty;
          if (ms(s.transitionDuration) > 1 && /all|transform|opacity/.test(props)) slow.push(`${el.tagName.toLowerCase()}${pseudo ?? ""}.${String(el.className).slice(0, 40)} transition ${s.transitionDuration} ${props}`);
          if (s.animationName !== "none" && ms(s.animationDuration) > 1) slow.push(`${el.tagName.toLowerCase()}${pseudo ?? ""}.${String(el.className).slice(0, 40)} animation ${s.animationName} ${s.animationDuration}`);
        }
      }
      const running = document.getAnimations().filter((a) => {
        const t = a.effect?.getComputedTiming?.();
        return t && Number(t.duration) > 1 && t.iterations !== 0;
      }).map((a) => `${a.animationName || a.transitionProperty || "anim"} ${a.effect.getComputedTiming().duration}ms`);
      return { motionOk, reveal: reveal.length, hiddenReveal: hiddenReveal.length, counters: counters.length, wrongCounters: wrongCounters.length, slow: slow.slice(0, 8), running: running.slice(0, 8) };
    });
    recordCheck(report, "motion", `${p}: klasa motion-ok nie jest ustawiona`, !state.motionOk);
    recordCheck(report, "motion", `${p}: ${state.reveal} blokow Reveal w pelni widoczne od razu (bez opacity/transform)`, state.hiddenReveal === 0, state.hiddenReveal ? `${state.hiddenReveal} ukrytych` : "");
    if (state.counters) recordCheck(report, "motion", `${p}: ${state.counters} CountUp pokazuje wartosc koncowa od razu`, state.wrongCounters === 0);
    recordCheck(report, "motion", `${p}: brak przejsc/animacji transform/opacity > 1 ms (emulowane 0.01 ms z motion.css)`, state.slow.length === 0, state.slow.join("; "));
    recordCheck(report, "motion", `${p}: brak dzialajacych animacji > 1 ms (document.getAnimations)`, state.running.length === 0, state.running.join("; "));
    await page.close();
  }
  await context.close();
}

async function manualZoom(browser, report, offerPath) {
  console.log("\n[d] Zoom 200% / 400% (viewport 640 / 320 CSS px)");
  const pages = ["/", "/promocje", offerPath, "/porownaj", "/quiz", "/banki", "/faq", "/konto/logowanie", "/regulamin"].filter(Boolean);
  for (const [label, width, height] of [["200% (640 px)", 640, 512], ["400% (320 px)", 320, 256]]) {
    const context = await newContext(browser, { width, height, theme: "light" });
    for (const p of pages) {
      const { page } = await openPage(context, opts.base + p);
      const r = await page.evaluate(() => {
        const vw = window.innerWidth;
        const doc = document.documentElement;
        const clipsX = (el) => {
          for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
            const o = getComputedStyle(n).overflowX;
            if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true;
          }
          return false;
        };
        const out = [];
        for (const el of document.querySelectorAll("body *")) {
          const s = getComputedStyle(el);
          if (s.position === "fixed" || s.display === "none" || s.visibility === "hidden") continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > vw + 1 && !clipsX(el) && !el.closest(".sr-only")) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} right=${Math.round(r.right)}`);
        }
        // Text cut off by overflow:hidden with no way to read it.
        const clipped = [];
        for (const el of document.querySelectorAll("body *")) {
          const s = getComputedStyle(el);
          if ((s.overflowX === "hidden" || s.overflow === "hidden") && el.scrollWidth > el.clientWidth + 2 && s.textOverflow === "clip" && !el.matches(".sr-only, [class*='sr-only']") && el.clientWidth > 0 && el.children.length === 0 && el.textContent.trim()) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 30)}"`);
        }
        const sticky = [];
        for (const el of document.querySelectorAll("header, body *")) {
          const s = getComputedStyle(el);
          if ((s.position === "fixed" || s.position === "sticky") && s.display !== "none") {
            // A sticky element only pins itself when its nearest vertical scroll container really scrolls
            // (a table frame without a max-height never scrolls vertically, so `sticky top-0` is inert there).
            if (s.position === "sticky") {
              let box = el.parentElement;
              while (box && box !== document.body && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
              if (box && box !== document.body && box.scrollHeight <= box.clientHeight + 1) continue;
            }
            const r = el.getBoundingClientRect();
            if (r.height > 0 && r.width > 0) sticky.push({ desc: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}`, h: Math.round(r.height) });
          }
        }
        return { scrollWidth: doc.scrollWidth, vw, overflow: out.slice(0, 6), clipped: clipped.slice(0, 5), sticky: sticky.slice(0, 6), vh: window.innerHeight };
      });
      const hs = r.scrollWidth > r.vw + 1;
      recordCheck(report, "zoom", `${label} ${p}: brak poziomego scrolla`, !hs, hs ? `scrollWidth ${r.scrollWidth} > ${r.vw}` : "");
      if (r.overflow.length) recordCheck(report, "zoom", `${label} ${p}: elementy wystajace poza viewport`, false, r.overflow.join("; "));
      if (r.clipped.length) recordCheck(report, "zoom", `${label} ${p}: tekst ucinany przez overflow:hidden`, null, r.clipped.join("; "));
      const tall = r.sticky.filter((s) => s.h > r.vh * 0.4);
      if (tall.length) recordCheck(report, "zoom", `${label} ${p}: przypiete elementy zajmuja > 40% wysokosci okna`, null, tall.map((s) => `${s.desc} ${s.h}px z ${r.vh}px`).join("; "));
      await page.close();
    }
    await context.close();
  }
}

async function manualTargets(browser, report, offerPath) {
  console.log("\n[e] Rozmiar celow dotyku (WCAG 2.5.8: >= 24x24 CSS px; glowne CTA >= 44 px na mobile)");
  const pages = ["/", "/promocje", offerPath, "/porownaj", "/quiz", "/banki", "/konta-osobiste-z-premia", "/faq", "/konto/logowanie"].filter(Boolean);
  for (const width of [360, 1280]) {
    const context = await newContext(browser, { width, theme: "light" });
    for (const p of pages) {
      const { page } = await openPage(context, opts.base + p);
      const r = await page.evaluate((sel) => {
        const small = [];
        const cta = [];
        let counted = 0;
        for (const el of document.querySelectorAll(sel)) {
          if (el.closest("[inert], [aria-hidden='true']") || el.disabled) continue;
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden") continue;
          let r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.closest(".sr-only") || (s.position === "absolute" && r.width <= 1)) continue;
          // A checkbox / radio is activated through its label as well: measure the label when there is one.
          if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")) {
            const label = el.closest("label") || (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
            if (label) r = label.getBoundingClientRect();
          }
          // A ::before / ::after hit area (absolute, larger than the element) is part of the target.
          let w = r.width;
          let hgt = r.height;
          for (const pseudo of ["::before", "::after"]) {
            const ps = getComputedStyle(el, pseudo);
            if (ps.content !== "none" && ps.position === "absolute" && ps.pointerEvents !== "none") {
              const pw = parseFloat(ps.width);
              const ph = parseFloat(ps.height);
              if (pw > w) w = pw;
              if (ph > hgt) hgt = ph;
            }
          }
          counted++;
          const text = (el.getAttribute("aria-label") || el.innerText || el.value || "").trim().replace(/\s+/g, " ").slice(0, 36);
          const href = el.getAttribute("href") || "";
          // WCAG 2.5.8 exempts links inside a sentence ("inline"): an <a> whose display is inline.
          const inline = el.tagName === "A" && s.display === "inline";
          if (!inline && (w < 23.5 || hgt < 23.5)) small.push(`${el.tagName.toLowerCase()}[${href.slice(0, 30)}] "${text}" ${Math.round(w)}x${Math.round(hgt)}`);
          if (el.tagName === "A" && href.startsWith("/out/")) cta.push({ text, h: Math.round(r.height), w: Math.round(r.width) });
        }
        const headerButtons = [...document.querySelectorAll('button[aria-label="Menu"], header button, header a')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => ({ text: (b.getAttribute("aria-label") || b.innerText || "").trim().slice(0, 24), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) }));
        return { small: small.slice(0, 12), smallCount: small.length, counted, cta, headerButtons };
      }, FOCUSABLE);
      recordCheck(report, "targets", `${width}px ${p}: ${r.counted} celi, wszystkie nie-inline >= 24x24`, r.smallCount === 0, r.smallCount ? `${r.smallCount} za malych: ${r.small.join("; ")}` : "");
      if (width === 360 && r.cta.length) {
        const low = r.cta.filter((c) => c.h < 44);
        recordCheck(report, "targets", `360px ${p}: ${r.cta.length} przyciskow CTA (/out/) >= 44 px wysokosci`, low.length === 0, low.length ? low.map((c) => `${c.text} ${c.w}x${c.h}`).join("; ") : `min ${Math.min(...r.cta.map((c) => c.h))} px`);
      }
      if (width === 360 && p === "/") {
        const menuBtn = r.headerButtons.find((b) => b.text === "Menu");
        recordCheck(report, "targets", "360px /: przycisk Menu >= 44x44", !!menuBtn && menuBtn.h >= 44 && menuBtn.w >= 44, menuBtn ? `${menuBtn.w}x${menuBtn.h}` : "brak");
      }
      await page.close();
    }
    await context.close();
  }
}

async function runManual(browser, pages) {
  const report = [];
  const offerEntry = pages.find((p) => p.note === "oferta aktywna");
  const offerPath = offerEntry ? offerEntry.path : null;
  const sections = [manualKeyboard, manualFocusVisible, manualReducedMotion, manualZoom, manualTargets];
  for (const section of sections) {
    try {
      await section(browser, report, offerPath);
    } catch (error) {
      recordCheck(report, section.name, `${section.name}: kontrola przerwana`, false, String(error?.message ?? error).split("\n")[0]);
    }
  }
  return report;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  try {
    const res = await fetch(opts.base + "/", { signal: AbortSignal.timeout(opts.timeout) });
    if (!res.ok) die(`Serwer ${opts.base} odpowiedzial ${res.status}`);
  } catch (error) {
    die(`Serwer ${opts.base} niedostepny (${error?.message ?? error}). Uruchom go najpierw (npm run dev / npm start).`);
  }
  const pages = await buildPages();
  let browser;
  try {
    browser = await chromium.launch({ headless: !opts.headed });
  } catch (error) {
    die(`Nie mozna uruchomic Chromium (${error?.message ?? error}). Sprobuj: npx playwright install chromium`);
  }
  const output = { base: opts.base, startedAt: new Date().toISOString(), axeVersion: JSON.parse(fs.readFileSync(require.resolve("axe-core/package.json"), "utf8")).version, tags: AXE_TAGS, options: { widths: opts.widths, themes: opts.themes } };
  let failed = false;
  try {
    if (opts.axe) {
      console.log(`Audyt axe: ${pages.length} stron x ${opts.widths.length} szerokosci x ${opts.themes.length} motywow (${opts.base})\n`);
      const results = await runAxe(browser, pages);
      const summary = summariseAxe(results);
      output.axe = { results, totals: summary.totals };
      failed = failed || summary.failed;
    }
    if (opts.manual) {
      const manual = await runManual(browser, pages);
      output.manual = manual;
      const bad = manual.filter((m) => m.ok === false);
      console.log(`\n=== Kontrole reczne: ${manual.filter((m) => m.ok === true).length} OK, ${bad.length} BLEDOW, ${manual.filter((m) => m.ok === null).length} uwag ===`);
      for (const m of bad) console.log(`- [${m.group}] ${m.name}: ${m.detail ?? ""}`);
      if (bad.length) failed = true;
    }
  } finally {
    await browser.close();
  }
  output.finishedAt = new Date().toISOString();
  output.failed = failed;
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(output, null, 2));
  console.log(`\nRaport JSON: ${opts.out}`);
  console.log(failed ? "WYNIK: sa naruszenia (kod wyjscia 1)" : "WYNIK: brak naruszen na wybranych poziomach");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => die(`Blad audytu: ${error?.stack ?? error}`));
