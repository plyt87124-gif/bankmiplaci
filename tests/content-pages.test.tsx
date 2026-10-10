import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HowItWorksPage from "../src/app/jak-to-dziala/page";
import FaqPage from "../src/app/faq/page";
import HowWeEarnPage from "../src/app/jak-zarabiamy/page";
import AboutPage from "../src/app/o-nas/page";
import KontaktPage from "../src/app/kontakt/page";
import Regulamin from "../src/app/regulamin/page";
import { MethodologyContent } from "../src/app/metodologia/MethodologyContent";
import { FAQ_GROUPS, FAQ_ITEMS } from "../src/app/faq/faqItems";
import { PUBLISHER, publisherAddress } from "../src/lib/publisher";
import { buildContactEmailHtml, contactEmailSubject, escapeHtml } from "../src/app/kontakt/contactEmail";
import { initialMessageFor } from "../src/app/kontakt/initialMessage";
import { RATING_FLOOR, explainRating, type RatableOffer } from "../src/app/metodologia/ratingModel";
import type { MethodologyData } from "../src/app/metodologia/loadMethodologyData";
import { COMMISSION_WEIGHT, recommendedScores, sortRecommended } from "../src/lib/recommended";
import { RATING_COMMISSION_RULE } from "../src/lib/disclosureCopy";
import { isRouteLive, liveRoutes } from "../src/lib/seo/routes";
import { DESCRIPTION_MAX, STATIC_PAGE_META } from "../src/lib/seo";

// tsx compiles .tsx with the classic JSX transform: give the pages the global React.
(globalThis as { React?: typeof React }).React = React;

const ROOT = process.cwd();
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** What a reader sees: tags removed, entities decoded, whitespace collapsed. */
const text = (markup: string) => decode(markup.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// --- fixtures for the methodology page (no database) -------------------------

function offer(id: string, extra: Partial<RatableOffer> = {}): RatableOffer {
  return { id, accountType: "PERSONAL", maxBonusCents: 50000, difficulty: "EASY", cooldownMonths: null, durationMonths: 3, ...extra };
}
const FIXTURE_OFFERS: RatableOffer[] = [
  offer("a", { maxBonusCents: 30000, difficulty: "EASY", durationMonths: 2, cooldownMonths: 12 }),
  offer("b", { maxBonusCents: 90000, difficulty: "MEDIUM", durationMonths: 6, cooldownMonths: 24 }),
  offer("c", { maxBonusCents: 150000, difficulty: "HARD", durationMonths: 12, cooldownMonths: 36 }),
  offer("d", { maxBonusCents: 60000, difficulty: "VERY_EASY", durationMonths: 3, cooldownMonths: null })
];
const EXAMPLE = explainRating(FIXTURE_OFFERS[1]!, FIXTURE_OFFERS);
const DATA: MethodologyData = {
  example: {
    slug: "bank-oferta-b",
    name: "Oferta B",
    bankName: "Bank Testowy",
    accountType: "PERSONAL",
    difficulty: "MEDIUM",
    storedRating: EXAMPLE.rating,
    breakdown: EXAMPLE
  },
  ratingStats: { count: 4, min: 8.4, max: 9.6 },
  latestVerifiedAt: new Date("2026-10-07T08:00:00Z")
};

async function renderAll(): Promise<Record<string, string>> {
  return {
    "/jak-to-dziala": html(HowItWorksPage()),
    "/faq": html(FaqPage()),
    "/jak-zarabiamy": html(HowWeEarnPage()),
    "/o-nas": html(AboutPage()),
    "/kontakt": html(await KontaktPage({ searchParams: Promise.resolve({}) })),
    "/metodologia": html(React.createElement(MethodologyContent, { data: DATA })),
    "/regulamin": html(Regulamin())
  };
}

const MY_PAGES = ["/jak-to-dziala", "/faq", "/jak-zarabiamy", "/o-nas", "/kontakt", "/metodologia"] as const;

// ---------------------------------------------------------------------------
// Structure shared by every page
// ---------------------------------------------------------------------------

test("each page has one h1, breadcrumbs with BreadcrumbList JSON-LD, and no forbidden design patterns", async () => {
  const pages = await renderAll();
  for (const path of MY_PAGES) {
    const page = pages[path]!;
    assert.equal((page.match(/<h1[\s>]/g) ?? []).length, 1, `${path}: exactly one h1`);
    assert.match(page, /aria-label="Ścieżka nawigacji"/, `${path}: breadcrumbs`);
    const ld = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
    const crumb = ld.find((n) => n["@type"] === "BreadcrumbList");
    assert.ok(crumb, `${path}: BreadcrumbList`);
    assert.equal(crumb.itemListElement.length, 2);
    assert.ok(String(crumb.itemListElement[1].item).endsWith(path), `${path}: last crumb points at the page`);
    assert.ok(!/text-ink-300|border-ink-100|bg-ink-solid|text-\[1[01]px\]|h-13|break-all|animate-ping|toFixed\(1\)/.test(page), `${path}: forbidden pattern`);
    assert.ok(!/target="_blank"/.test(page), `${path}: no new-tab links`);
  }
});

test("pages that have a table of contents list the same ids as their h2 headings", async () => {
  const pages = await renderAll();
  for (const path of ["/jak-to-dziala", "/faq", "/jak-zarabiamy", "/metodologia", "/o-nas"]) {
    const page = pages[path]!;
    const tocBlocks = [...page.matchAll(/<nav aria-label="Spis treści"[^>]*>([\s\S]*?)<\/nav>/g)].map((m) => m[1]!);
    assert.equal(tocBlocks.length, 2, `${path}: TOC rendered for mobile and for desktop`);
    const ids = [...page.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]!);
    assert.equal(new Set(ids).size, ids.length, `${path}: h2 ids are unique`);
    const hrefs = [...tocBlocks[0]!.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(hrefs, ids, `${path}: TOC entries == h2 ids, in order`);
  }
});

/** A page exists for the route; route groups such as "(lista)" are not URL segments. */
function pageExistsFor(route: string): boolean {
  const walk = (dir: string, segs: string[]): boolean => {
    if (segs.length === 0 && existsSync(join(dir, "page.tsx"))) return true;
    if (!existsSync(dir)) return false;
    if (segs.length > 0 && walk(join(dir, segs[0]!), segs.slice(1))) return true;
    return readdirSync(dir, { withFileTypes: true }).some((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && walk(join(dir, e.name), segs));
  };
  return walk(join(ROOT, "src", "app"), route.split("/").filter(Boolean));
}

test("every internal link on my pages leads to an existing page, and #fragments exist on the target", async () => {
  const pages = await renderAll();
  const hrefs = new Set<string>();
  for (const path of MY_PAGES) for (const m of pages[path]!.matchAll(/href="(\/[^"]*)"/g)) hrefs.add(decode(m[1]!));
  for (const href of hrefs) {
    const [pathAndQuery, fragment] = href.split("#");
    const route = pathAndQuery!.split("?")[0]!;
    if (route === "/") continue;
    const dynamic = /^\/promocje\/[a-z0-9-]+$/.test(route) && route !== "/promocje/konczace-sie";
    assert.ok(dynamic || pageExistsFor(route), `${href}: no such page`);
    if (fragment && pages[route]) assert.ok(pages[route]!.includes(`id="${fragment}"`), `${href}: no element with id="${fragment}"`);
  }
});

// ---------------------------------------------------------------------------
// /jak-zarabiamy
// ---------------------------------------------------------------------------

test("/jak-zarabiamy keeps #ocena and #polecane, opens with the plan's sentence and states the rule", async () => {
  const page = (await renderAll())["/jak-zarabiamy"]!;
  assert.match(page, /<h2 id="ocena"/);
  assert.match(page, /<h2 id="polecane"/);
  const body = text(page);
  assert.ok(body.includes("Zarabiamy z prowizji od banków za polecenie."));
  assert.ok(body.indexOf("Zarabiamy z prowizji od banków za polecenie.") < body.indexOf("Czym jest afiliacja"), "the sentence comes first");
  assert.ok(body.includes(RATING_COMMISSION_RULE));
  assert.ok(body.includes("Czego nie robimy"));
  assert.ok(body.includes("Oferta, na której nie zarabiamy, nadal jest na liście"));
  assert.match(page, /href="\/metodologia"/);
});

test("/jak-zarabiamy describes the 'Polecane' formula with the factors that recommendedScores really produces", async () => {
  const body = text((await renderAll())["/jak-zarabiamy"]!);
  const fmt = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  // Same account type, same rating 10, so the score IS the commission factor.
  const scores = recommendedScores([
    { accountType: "PERSONAL", rating: 10, maxBonusCents: 1, commissionCents: 10000 }, // best-paying
    { accountType: "PERSONAL", rating: 10, maxBonusCents: 1, commissionCents: 0 }, //   pays nothing
    { accountType: "PERSONAL", rating: 10, maxBonusCents: 1, commissionCents: null } // unknown
  ]);
  const [best, zero, unknown] = scores.map((s) => fmt.format(Math.round(s! * 100) / 100));
  assert.equal(best, "1,0");
  assert.equal(zero, fmt.format(Math.round((1 - COMMISSION_WEIGHT) * 100) / 100));
  assert.ok(body.includes(`liczba od ${zero} do ${best}`), "range of the factor");
  assert.ok(body.includes(`dostaje ${best} – jej ocena nie jest pomniejszana`));
  assert.ok(body.includes(`nie mniejszą jednak niż ${zero}`));
  assert.ok(
    body.includes(
      `Oferta bez danych o wynagrodzeniu jest traktowana tak, jakby bank płacił połowę najwyższej stawki w grupie (współczynnik ${unknown}) – czyli wyżej niż oferta, za którą nie dostajemy nic (${zero}).`
    ),
    "unknown commission = a stand-in for HALF of the best (0,8), above zero (0,6)"
  );
  assert.ok(body.includes(`najniższą wartość – ${zero}`));
  // The sentence is only true if the code really maps unknown to half of the best and zero to the floor.
  assert.ok(Math.abs(scores[2]! - 0.8) < 1e-12 && Math.abs(scores[1]! - 0.6) < 1e-12 && Math.abs(scores[0]! - 1) < 1e-12);
  // A partial commission is proportional: half of the best pays 1 - W/2.
  const half = recommendedScores([
    { accountType: "PERSONAL", rating: 10, maxBonusCents: 1, commissionCents: 10000 },
    { accountType: "PERSONAL", rating: 10, maxBonusCents: 1, commissionCents: 5000 }
  ])[1]!;
  assert.ok(Math.abs(half - (1 - COMMISSION_WEIGHT / 2)) < 1e-12);
});

test("/jak-zarabiamy does not understate the commission's influence (no 'nieco'), and the claim holds in the formula", async () => {
  const page = (await renderAll())["/jak-zarabiamy"]!;
  const body = text(page);
  assert.ok(!/nieco (niższ|wyższ)/i.test(body), "the 'nieco niższej ocenie' wording is gone");
  assert.ok(body.includes("Współczynnik wynagrodzenia zmienia wynik silniej niż różnice między ocenami serwisu"));
  assert.ok(body.includes("oferta o wyraźnie niższej ocenie"));
  // The page says the factor can outweigh rating differences. Prove it in the code the page describes:
  // 8.3 with the best commission beats 9.8 with the lowest, and even the lowest automatic rating
  // with the best commission beats a perfect 10 for which the bank pays nothing.
  const pair = sortRecommended([
    { accountType: "PERSONAL", rating: 9.8, maxBonusCents: 1, commissionCents: 1000 },
    { accountType: "PERSONAL", rating: 8.3, maxBonusCents: 1, commissionCents: 10000 }
  ]);
  assert.equal(pair[0]!.rating, 8.3);
  const extreme = sortRecommended([
    { accountType: "PERSONAL", rating: 10, maxBonusCents: 1, commissionCents: 0 },
    { accountType: "PERSONAL", rating: RATING_FLOOR, maxBonusCents: 1, commissionCents: 10000 }
  ]);
  assert.equal(extreme[0]!.rating, RATING_FLOOR);
});

test("/jak-zarabiamy#polecane says the comparison covers offers of one account type that are currently displayed", async () => {
  const page = (await renderAll())["/jak-zarabiamy"]!;
  const section = text(page.slice(page.indexOf('<h2 id="polecane"'), page.indexOf('<h2 id="ocena"')));
  assert.ok(section.includes("Porównanie dotyczy ofert tego samego typu konta, które są aktualnie wyświetlane."));
  assert.ok(section.includes("kolejność „Polecane” może wyglądać inaczej niż bez filtrów"));
  assert.ok(section.includes("które są w tej chwili wyświetlane na liście"));
});

test("/jak-zarabiamy lists exactly the sorts whose database ordering ignores the commission", () => {
  const source = readFileSync(join(ROOT, "src", "lib", "services", "promotions.ts"), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("export function sortToOrderBy");
  const fn = source.slice(start, source.indexOf("\n}\n", start));
  assert.ok(fn.length > 100, "sortToOrderBy found");
  assert.ok(!/commission/i.test(fn), "sortToOrderBy must not read the commission");
  for (const key of ["highest-bonus", "easiest", "newest", "ending-soon", "top-rated"]) assert.ok(fn.includes(key), key);
});

// ---------------------------------------------------------------------------
// /faq
// ---------------------------------------------------------------------------

test("/faq: FAQPage JSON-LD has the same questions and answers as the visible accordion", async () => {
  const page = (await renderAll())["/faq"]!;
  const raw = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!.map((s) => JSON.parse(s.replace(/<\/?script[^>]*>/g, "")));
  const faq = raw.find((n) => n["@type"] === "FAQPage");
  assert.ok(faq, "FAQPage present");
  assert.equal(faq.mainEntity.length, FAQ_ITEMS.length);

  const summaries = [...page.matchAll(/<summary[^>]*>[\s\S]*?<span class="min-w-0">([\s\S]*?)<\/span>/g)].map((m) => decode(m[1]!));
  assert.deepEqual(summaries, FAQ_ITEMS.map((i) => i.question));
  assert.deepEqual(faq.mainEntity.map((q: { name: string }) => q.name), summaries);
  const visible = text(page);
  for (const q of faq.mainEntity) assert.ok(visible.includes(q.acceptedAnswer.text), `answer not visible: ${q.name}`);
});

test("/faq: native details, only the first row open, brand name fixed, new questions present", async () => {
  const page = (await renderAll())["/faq"]!;
  const details = [...page.matchAll(/<details[^>]*class="accordion[^>]*>/g)].map((m) => m[0]);
  assert.equal(details.length, FAQ_ITEMS.length);
  assert.equal(details.filter((d) => /\sopen(=|\s|>)/.test(d)).length, 1);
  assert.match(details[0]!, /\sopen/);
  const all = text(page);
  assert.ok(!/na Premii|o Premię|Premia\.pl/.test(all), "the brand is Bankmiplaci, not Premia");
  assert.ok(all.includes("w Bankmiplaci jest bezpłatne"));
  assert.ok(!all.includes("warunki promocji będą takie same"), "the false 'identical conditions' claim is gone");
  const order = FAQ_ITEMS.find((i) => i.id === "kolejnosc-a-prowizja")!;
  assert.ok(order.answer.startsWith("Tak, domyślna kolejność „Polecane” uwzględnia wynagrodzenie partnerskie"), "answers the question plainly");
  assert.ok(!/Częściowo|nieco/.test(order.answer));
  assert.ok(order.answer.includes("oferta o wyraźnie niższej ocenie może w niej stać wyżej niż oferta o wyraźnie wyższej."));
  assert.ok(!/\(-aś\)|\(-ś\)/.test(all), "no '(-aś)' forms in the FAQ");
  for (const q of ["Czy kolejność ofert zależy od prowizji?", "Co to jest karencja?", "Czy od premii płaci się podatek?", "Kiedy bank wypłaca premię?"]) {
    assert.ok(FAQ_ITEMS.some((i) => i.question === q), q);
  }
  assert.equal(FAQ_GROUPS.length, 3);
});

test("/faq: answers are informational (roughly 25-90 words) and unique", () => {
  for (const item of FAQ_ITEMS) {
    const words = item.answer.split(/\s+/).length;
    assert.ok(words >= 25 && words <= 90, `${item.question}: ${words} words`);
  }
  assert.equal(new Set(FAQ_ITEMS.map((i) => i.question)).size, FAQ_ITEMS.length);
  assert.equal(new Set(FAQ_ITEMS.map((i) => i.id)).size, FAQ_ITEMS.length);
});

// ---------------------------------------------------------------------------
// /metodologia, /o-nas, /jak-to-dziala
// ---------------------------------------------------------------------------

test("/metodologia: components and weights equal the ones in ratings.ts, commission is excluded", async () => {
  const body = text((await renderAll())["/metodologia"]!);
  for (const [label, weight] of [["Wysokość premii", "30%"], ["Trudność zdobycia", "30%"], ["Czas trwania", "20%"], ["Średnia premia na miesiąc", "15%"], ["Karencja", "5%"]]) {
    assert.ok(new RegExp(`${label}[^%]*${weight}`).test(body), `${label} ${weight}`);
  }
  assert.ok(body.includes(RATING_COMMISSION_RULE));
  assert.ok(body.includes("Ocena serwisu, nie porada finansowa."));
  assert.ok(body.includes("Najnowsza z tych dat wśród aktualnych ofert to 7 paź 2026"));
  assert.ok(body.includes("pokazujemy ją jako „Najnowsza weryfikacja oferty”"), "the same name as the footer, the hero and the lists");
  assert.ok(body.includes("od 8,4 do 9,6"));
  assert.ok(/6,5 \+ 3,5 × √/.test(body));
});

test("/metodologia: natural wording, the scale starts where ratings.ts says, meta description promises nothing the page does not do", async () => {
  const body = text((await renderAll())["/metodologia"]!);
  assert.ok(body.includes("Ocenę serwisu liczymy sami, według jawnych zasad opisanych niżej. Służy do porównania aktualnych promocji."));
  assert.ok(!body.includes("Oceną serwisu porównujemy"));
  assert.ok(body.includes(`To liczba od ${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1 }).format(RATING_FLOOR)} do 10 (np. 9,4/10)`));
  assert.ok(!body.includes("z przedziału do 10"));
  const ratingsSource = readFileSync(join(ROOT, "src", "lib", "services", "ratings.ts"), "utf8");
  assert.ok(ratingsSource.includes(`${RATING_FLOOR} + `), "RATING_FLOOR is the real lower bound of ratings.ts");
  const description = STATIC_PAGE_META.metodologia.description;
  assert.ok(description.length <= DESCRIPTION_MAX);
  assert.ok(!/jak często/.test(description), "the page deliberately gives no verification frequency");
  assert.ok(description.includes("co znaczy „Zweryfikowano”") && description.includes("prowizji"));
});

test("/metodologia: the worked example shows its arithmetic and no commission line", async () => {
  const page = (await renderAll())["/metodologia"]!;
  assert.match(page, /<h2 id="przyklad"/);
  const body = text(page);
  assert.ok(body.includes("Bank Testowy – Oferta B"));
  assert.ok(body.includes(`${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(EXAMPLE.rating)}/10`));
  assert.ok(!/prowizj[a-z]* [0-9]|wynagrodzenie partnerskie \(/i.test(body));
  const sum = EXAMPLE.components.reduce((acc, c) => acc + c.contribution, 0);
  assert.ok(Math.abs(sum - EXAMPLE.composite) < 1e-12);
});

test("/metodologia without live data still reads well (no example, no stats, no date)", () => {
  const page = html(React.createElement(MethodologyContent, { data: { example: null, ratingStats: null, latestVerifiedAt: null } }));
  assert.ok(!page.includes('id="przyklad"'));
  assert.ok(!/Najnowsza z tych dat/.test(text(page)));
  const ids = [...page.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]!);
  const hrefs = [...page.matchAll(/<nav aria-label="Spis treści"[^>]*>([\s\S]*?)<\/nav>/g)][0]![1]!.matchAll(/href="#([^"]+)"/g);
  assert.deepEqual([...hrefs].map((m) => m[1]), ids);
});

test("/o-nas: publisher data are exactly those already public in the Regulamin; nothing invented", async () => {
  const pages = await renderAll();
  const about = text(pages["/o-nas"]!);
  const regulamin = readFileSync(join(ROOT, "src", "app", "regulamin", "page.tsx"), "utf8");
  for (const value of [PUBLISHER.name, publisherAddress(), PUBLISHER.nip, PUBLISHER.regon, PUBLISHER.email]) {
    assert.ok(regulamin.includes(value), `Regulamin does not contain ${value}`);
    assert.ok(about.includes(value), `/o-nas does not show ${value}`);
  }
  assert.ok(/JDG/.test(regulamin));
  const invented = /zespół|ekspert|założon|\bnagrod|doświadczen|redaktor/i.exec(about);
  assert.equal(invented, null, `invented team/expert/award wording: ${invented?.[0]}`);
  for (const id of ["wydawca", "weryfikacja", "finansowanie", "zasady", "korekty", "kontakt"]) assert.match(pages["/o-nas"]!, new RegExp(`<h2 id="${id}"`));
});

test("publisher data have ONE source (src/lib/publisher.ts) shared by the footer, /o-nas and /kontakt", () => {
  assert.ok(!existsSync(join(ROOT, "src", "app", "o-nas", "publisher.ts")), "the duplicate publisher module is gone");
  for (const file of [["app", "o-nas", "page.tsx"], ["app", "kontakt", "page.tsx"], ["components", "Footer.tsx"]]) {
    const code = readFileSync(join(ROOT, "src", ...file), "utf8");
    assert.ok(code.includes('@/lib/publisher'), `${file.join("/")} imports the shared publisher module`);
    assert.ok(!/o-nas\/publisher|\.\/publisher/.test(code), `${file.join("/")} does not import a second copy`);
  }
});

test("/jak-zarabiamy, /o-nas, /kontakt: natural Polish instead of calques", async () => {
  const pages = await renderAll();
  assert.ok(text(pages["/jak-zarabiamy"]!).includes("Korzystanie z Bankmiplaci jest bezpłatne dla użytkowników."));
  assert.ok(!/(?<!z )Bankmiplaci jest bezpłatne/.test(text(pages["/jak-zarabiamy"]!)), "no subject-less calque");
  const contact = text(pages["/kontakt"]!);
  assert.ok(!/Zauważyłeś/.test(contact), "no '(-aś)' form on /kontakt");
  assert.ok(contact.includes("Nieaktualna promocja albo błąd w warunkach? Daj nam znać"));
  assert.ok(!/Zauważyłeś/.test(STATIC_PAGE_META.kontakt.description));
  for (const [path, page] of Object.entries(pages)) assert.ok(!/\(-aś\)|\(-ś\)/.test(text(page)) || path === "/regulamin", `${path}: no '(-aś)'`);
});

test("/jak-to-dziala: step count comes from the data, glossary explains karencja and KYC", async () => {
  const page = (await renderAll())["/jak-to-dziala"]!;
  const steps = [...page.matchAll(/<h3 id="krok-(\d+)"/g)].length;
  assert.equal(steps, 4);
  const body = text(page);
  assert.ok(body.includes(`${steps} kroki od wyboru do premii`));
  assert.match(page, /<h2 id="slowniczek"/);
  assert.match(page, /<dt>Karencja<\/dt>/);
  assert.match(page, /<dt>KYC \(weryfikacja tożsamości\)<\/dt>/);
  assert.ok(!body.includes("Odhaczasz"), "wording from the plan: 'zaznaczasz'");
});

// ---------------------------------------------------------------------------
// /kontakt and the contact e-mail
// ---------------------------------------------------------------------------

test("/kontakt: labelled fields with autocomplete, mailto, data-protection clause, status region", async () => {
  const page = (await renderAll())["/kontakt"]!;
  assert.match(page, /<label[^>]*for="[^"]+"[^>]*>Twój e-mail/);
  assert.match(page, /type="email"[^>]*autoComplete="email"|autoComplete="email"[^>]*type="email"|autocomplete="email"/i);
  assert.match(page, /<textarea[^>]*name="message"/);
  assert.match(page, /href="mailto:pomoc@bankmiplaci.pl"/);
  assert.match(page, /role="status"/);
  const body = text(page);
  assert.ok(body.includes("Administratorem danych jest Michał Kamiński"));
  assert.match(page, /href="\/polityka-prywatnosci"/);
  assert.ok(!/ink-solid/.test(page));
});

test("/kontakt?oferta=slug starts the message with the offer; anything but a plain slug is ignored", async () => {
  const withOffer = html(await KontaktPage({ searchParams: Promise.resolve({ oferta: "alior-konto-z-premia" }) }));
  assert.ok(decode(withOffer).includes("Dotyczy oferty: /promocje/alior-konto-z-premia"));
  assert.equal(initialMessageFor(undefined), "");
  assert.equal(initialMessageFor("<script>alert(1)</script>"), "");
  assert.equal(initialMessageFor("https://evil.example/x"), "");
  assert.equal(initialMessageFor("a".repeat(121)), "");
  assert.equal(initialMessageFor(["ok-slug", "other"]), initialMessageFor("ok-slug"));
});

test("contact e-mail: visitor text is HTML-escaped, the subject stays on one line", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert('1')"> & co`), "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt; &amp; co");
  const out = buildContactEmailHtml({ email: "a@b.pl", message: "<b>hej</b>\n<script>alert(1)</script>" });
  assert.ok(!out.includes("<script>") && !out.includes("<b>"));
  assert.ok(out.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(out.includes("<strong>Od:</strong> a@b.pl"));
  assert.ok(!/\n/.test(contactEmailSubject("x@y.pl\r\nBcc: z@z.pl")));
});

test("the contact route no longer logs the visitor's address or message", () => {
  const route = readFileSync(join(ROOT, "src", "app", "api", "contact", "route.ts"), "utf8");
  const logCalls = route.match(/console\.(log|error|warn)\([^;]*;/g) ?? [];
  assert.ok(logCalls.length > 0);
  for (const call of logCalls) assert.ok(!/parsed\.data|\.email|\.message/.test(call), call);
  assert.ok(route.includes("buildContactEmailHtml"));
});

// ---------------------------------------------------------------------------
// Sitemap flags and privacy of the commission
// ---------------------------------------------------------------------------

test("/metodologia and /o-nas are live in the sitemap registry and have pages", () => {
  for (const path of ["/metodologia", "/o-nas"]) {
    assert.ok(isRouteLive(path), path);
    assert.ok(liveRoutes().some((r) => r.path === path));
    assert.ok(pageExistsFor(path));
  }
});

test("none of the WP-13 sources reads the commission or the affiliate URL", () => {
  const dirs = ["jak-to-dziala", "faq", "jak-zarabiamy", "metodologia", "o-nas", "kontakt"].map((d) => join(ROOT, "src", "app", d));
  const files: string[] = [join(ROOT, "src", "components", "FaqAccordion.tsx")];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  dirs.forEach(walk);
  for (const file of files) {
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/affiliateCommission|affiliateUrl|commissionCents/.test(code), `${file} touches commission/affiliate fields`);
    assert.ok(!/NEXT_PUBLIC_SITE_URL/.test(code), `${file} reads the site URL directly`);
    assert.ok(!/dangerouslySetInnerHTML/.test(code), `${file} writes raw HTML`);
  }
});

// ---------------------------------------------------------------------------
// F2A: wording corrected after the content audit
// ---------------------------------------------------------------------------

test("/jak-zarabiamy: title says it affects the order, defines the term once, no self-praise, 'Polecane' is not a recommendation", async () => {
  const page = (await renderAll())["/jak-zarabiamy"]!;
  const body = text(page);
  assert.match(page, /<h1[^>]*>Jak zarabiamy – afiliacja i wpływ na kolejność ofert<\/h1>/);
  assert.ok(!body.includes("niezależność oceny"));
  assert.ok(body.includes("Wynagrodzenie partnerskie (w skrócie: prowizja) to kwota, którą płaci nam bank lub sieć partnerska."));
  assert.ok(body.includes("Wpływa ono na domyślną kolejność „Polecane” (szczegóły niżej), ale nie na ocenę serwisu."));
  assert.equal((body.match(/w skrócie: prowizja/g) ?? []).length, 1, "the definition appears once");
  assert.ok(body.indexOf("w skrócie: prowizja") < body.indexOf("Czym jest afiliacja"), "defined at first use, in the lead");
  assert.ok(!body.includes("To częsty model finansowania porównywarek"));
  assert.ok(
    body.includes("To nie jest indywidualna rekomendacja ani porada. „Polecane” to domyślna kolejność, w której uwzględniamy wynagrodzenie partnerskie, więc nie oznacza „najlepszej oferty dla Ciebie”.")
  );
  assert.match(page, /<h2 id="rekomendacja"/);
  assert.match(page, /<h2 id="ocena"/);
  assert.match(page, /<h2 id="polecane"/);
});

test("/jak-zarabiamy: the 6,5-10 range carries the manual-exception caveat and links to the methodology", async () => {
  const page = (await renderAll())["/jak-zarabiamy"]!;
  const body = text(page);
  assert.ok(body.includes("w wyjątkowych przypadkach ustawiana ręcznie, także spoza tego przedziału – zob. metodologia"));
  assert.match(page, /href="\/metodologia#czym-jest-ocena"/);
  const methodology = (await renderAll())["/metodologia"]!;
  assert.match(methodology, /<h2 id="czym-jest-ocena"/, "the link target exists");
});

test("the manual-rating wording follows the code: the reason is optional in the admin form, so no page promises one", () => {
  const validation = readFileSync(join(ROOT, "src", "lib", "validation", "promotion.ts"), "utf8");
  assert.match(validation, /ratingReason: z\.string\(\)\.max\(280\)\.optional\(\)/, "if this becomes required, the pages may say 'zawsze podajemy uzasadnienie'");
  const methodology = readFileSync(join(ROOT, "src", "app", "metodologia", "MethodologyContent.tsx"), "utf8");
  assert.ok(methodology.includes("może być widoczne krótkie uzasadnienie"));
  assert.ok(!/zawsze podajemy uzasadnienie/.test(methodology));
});

test("/jak-to-dziala: checklist marks are not passed to banks, reminders are not promised as a standing feature", async () => {
  const body = text((await renderAll())["/jak-to-dziala"]!);
  assert.ok(body.includes("Zaznaczenia w ściądze nie są przekazywane bankom."));
  assert.ok(!body.includes("służą tylko Tobie"));
  assert.ok(!body.includes("a serwis przypomina o zbliżających się terminach"));
  assert.ok(body.includes("serwis może wysłać e-mail z przypomnieniem – nie gwarantujemy jednak jego wysyłki"));
});

test("karencja has ONE definition (glossary.ts) on /faq, the home shortcut, /promocje FAQ and /jak-to-dziala", async () => {
  const { KARENCJA_DEFINITION } = await import("../src/lib/glossary");
  const { LISTING_FAQ } = await import("../src/components/promocje/editorialContent");
  const { homeFaqItems } = await import("../src/components/home/homeContent");
  assert.ok(KARENCJA_DEFINITION.startsWith("Karencja to okres wymagany przez regulamin promocji, w którym bank nie uznaje Cię za nowego klienta"));
  assert.ok(KARENCJA_DEFINITION.includes("od daty zamknięcia konta albo od stałej daty podanej w regulaminie"));
  assert.ok(FAQ_ITEMS.find((i) => i.id === "karencja")!.answer.startsWith(KARENCJA_DEFINITION));
  assert.ok(homeFaqItems().find((i) => i.id === "karencja")!.answer.startsWith(KARENCJA_DEFINITION));
  assert.ok(LISTING_FAQ.find((i) => i.question === "Co to jest karencja?")!.answer.startsWith(KARENCJA_DEFINITION));
  assert.ok(text((await renderAll())["/jak-to-dziala"]!).includes(KARENCJA_DEFINITION));
  // The old, competing wording is gone from the sources.
  for (const file of [["app", "faq", "faqItems.ts"], ["components", "promocje", "editorialContent.ts"], ["app", "jak-to-dziala", "page.tsx"]]) {
    const code = readFileSync(join(ROOT, "src", ...file), "utf8");
    assert.ok(!/na przykład po zamknięciu konta albo po poprzedniej promocji|Zwykle liczy się go od dnia zamknięcia poprzedniego konta/.test(code), file.join("/"));
  }
});

test("/faq: 'Czy muszę mieć konto', 'Jak działa ściąga' and 'Co znaczy Zweryfikowano' are there and match the code", () => {
  const ask = (id: string) => FAQ_ITEMS.find((i) => i.id === id)!;
  assert.equal(ask("czy-musze-miec-konto").question, "Czy muszę mieć konto w serwisie?");
  assert.ok(ask("czy-musze-miec-konto").answer.startsWith("Nie."));
  assert.equal(ask("jak-dziala-sciaga").question, "Jak działa ściąga?");
  assert.equal(ask("jak-dziala-sciaga").link?.href, "/jak-to-dziala#kroki");
  assert.equal(ask("co-znaczy-zweryfikowano").question, "Co znaczy „Zweryfikowano”?");
  assert.equal(ask("co-znaczy-zweryfikowano").link?.href, "/metodologia#weryfikacja");
  // Each claim of the first answer is a login wall in the code: the checklist, comments and the eligibility prompt.
  const joinRoute = readFileSync(join(ROOT, "src", "app", "api", "checklist", "join", "route.ts"), "utf8");
  const comments = readFileSync(join(ROOT, "src", "app", "api", "promotions", "[slug]", "comments", "route.ts"), "utf8");
  const banner = readFileSync(join(ROOT, "src", "components", "EligibilityBanner.tsx"), "utf8");
  assert.ok(/if \(!user\) return NextResponse\.json/.test(joinRoute));
  assert.ok(/Musisz być zalogowany, aby komentować/.test(comments));
  assert.ok(banner.includes("Zaloguj się, by sprawdzić, czy możesz skorzystać"));
  for (const path of ["quiz", "porownaj"]) {
    const dir = join(ROOT, "src", "app", path);
    const hits = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && /getCurrentUser|useOptionalSession/.test(readFileSync(join(dir, f), "utf8")));
    assert.deepEqual(hits, [], `/${path} needs no account`);
  }
});
