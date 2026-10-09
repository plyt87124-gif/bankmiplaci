import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
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
  const html = renderToStaticMarkup(<LegalPage title="T"><p>x</p></LegalPage>);
  assert.ok(!html.includes("Spis treści"));
});
