import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LegalPage } from "../src/components/LegalPage";
import Regulamin from "../src/app/regulamin/page";
import Polityka from "../src/app/polityka-prywatnosci/page";
import Cookies from "../src/app/cookies/page";

const pages = { regulamin: Regulamin, "polityka-prywatnosci": Polityka, cookies: Cookies };

for (const [name, Page] of Object.entries(pages)) {
  test(`${name}: każda pozycja spisu treści ma nagłówek z tym id`, () => {
    const html = renderToStaticMarkup(createElement(Page));
    const hrefs = [...html.matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 6, "spis treści nie jest pusty");
    const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, "id nagłówków są unikalne");
    for (const h of new Set(hrefs)) assert.ok(ids.includes(h), `brak h2#${h}`);
    // Spis jest renderowany dwa razy (mobile + desktop), nagłówki raz.
    assert.equal(hrefs.length, ids.length * 2);
  });

  test(`${name}: brak zakazanych wzorców i jedno h1`, () => {
    const html = renderToStaticMarkup(createElement(Page));
    assert.equal((html.match(/<h1/g) ?? []).length, 1);
    assert.ok(!/text-ink-300|text-\[1[01]px\]/.test(html));
  });
}

test("LegalPage bez sections nie renderuje spisu treści", () => {
  const html = renderToStaticMarkup(<LegalPage title="T" path="/t"><p>x</p></LegalPage>);
  assert.ok(!html.includes("Spis treści"));
});

for (const [name, Page] of Object.entries(pages)) {
  test(`${name}: okruszki i BreadcrumbList JSON-LD`, () => {
    const html = renderToStaticMarkup(createElement(Page));
    assert.ok(html.includes('aria-label="Ścieżka nawigacji"'));
    assert.ok(html.includes('aria-current="page"'));
    const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    assert.ok(m, "brak JSON-LD");
    const ld = JSON.parse(m[1]!.replace(/\u003c/g, "<").replace(/\u003e/g, ">").replace(/\u0026/g, "&"));
    assert.equal(ld["@type"], "BreadcrumbList");
    assert.equal(ld.itemListElement.length, 2);
    assert.ok(String(ld.itemListElement[1].item).endsWith(`/${name}`));
  });
}

test("LegalPage: JSON-LD i ostatni okruszek pochodzą z jawnego path, a nie z tytułu", () => {
  // Tytuł identyczny ze znanym tytułem, ale inna ścieżka: dawna mapa po tytule dałaby /regulamin.
  const html = renderToStaticMarkup(<LegalPage title="Regulamin serwisu" path="/inna-sciezka"><p>a</p></LegalPage>);
  const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
  assert.ok(m, "brak JSON-LD");
  const ld = JSON.parse(m[1]!);
  assert.equal(ld.itemListElement[1].name, "Regulamin serwisu");
  assert.ok(String(ld.itemListElement[1].item).endsWith("/inna-sciezka"));
  assert.ok(!html.includes("/regulamin\""), "ścieżka nie jest zgadywana z tytułu");
});

test("LegalPage nie wycisza akapitów z racji położenia (first/last-child), tylko oznaczone data-legal-date", () => {
  const src = readFileSync(join(process.cwd(), "src", "components", "LegalPage.tsx"), "utf8");
  assert.ok(!/p:first-child|p:last-child/.test(src), "selektory pozycyjne usunięte");
  assert.ok(src.includes("[&>p[data-legal-date]]:text-ink-500"), "reguła dla oznaczonego akapitu");
  assert.ok(!src.includes("KNOWN_PATHS"), "mapa ścieżek po tytule usunięta");
});

for (const [name, Page] of Object.entries(pages)) {
  test(`${name}: data (obowiązywania, aktualizacji) jest oznaczona jawnie i tylko ona`, () => {
    const html = renderToStaticMarkup(createElement(Page));
    const marked = [...html.matchAll(/<p data-legal-date="[^"]*">([^<]*)<\/p>/g)].map((m) => m[1]!);
    assert.ok(marked.length >= 1, "brak oznaczonej daty");
    for (const text of marked) assert.match(text, /^Data (wejścia w życie|obowiązywania|ostatniej aktualizacji): \d{2}\.\d{2}\.\d{4}$/);
    // Każdy akapit zaczynający się od "Data ..." jest oznaczony, a żaden inny nie jest.
    const allDates = [...html.matchAll(/<p[^>]*>Data (?:wejścia w życie|obowiązywania|ostatniej aktualizacji):/g)];
    assert.equal(allDates.length, marked.length);
    assert.equal((html.match(/<p[^>]*data-legal-date/g) ?? []).length, marked.length);
  });
}
