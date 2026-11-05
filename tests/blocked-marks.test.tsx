// Komunikat nad kafelkiem oferty (jesteś już klientem, karencja trwa, masz tę ściągę): kolorowe tło, gruba ikona,
// tekst wyśrodkowany. Testujemy znacznik z renderu serwerowego; sama zasłona i jej znikanie po najechaniu
// to CardBlockedMark (kontekst z requestu), tu sprawdzamy to, co widać w ramce.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockedMarkBox, type ClientMark } from "../src/components/BlockedOffers";

const render = (mark: ClientMark) => renderToStaticMarkup(h(BlockedMarkBox, { mark }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("klient banku i karencja: czerwone tło z tekstem on-coral, joined: niebieskie tło z tekstem on-action", () => {
  for (const mark of [{ slug: "a", reason: "client" }, { slug: "a", reason: "karencja", until: null }] as const) {
    const html = render(mark);
    assert.match(html, /bg-coral-600 text-on-coral/);
    assert.doesNotMatch(html, /bg-action|ring-1/);
  }
  const joined = render({ slug: "a", reason: "joined" });
  assert.match(joined, /bg-action text-on-action/);
  assert.doesNotMatch(joined, /bg-coral-600/);
});

test("tekst jest wyśrodkowany, ikona gruba i nad tekstem", () => {
  const html = render({ slug: "a", reason: "client" });
  assert.match(html, /flex-col items-center/);
  assert.match(html, /text-center/);
  assert.match(html, /stroke-width="2\.75"/, "gruba ikona kłódki");
  assert.ok(html.indexOf("<svg") < html.indexOf("Już jesteś klientem"), "ikona stoi nad napisem");
});

test("treść komunikatów bez zmian", () => {
  assert.equal(text(render({ slug: "a", reason: "client" })), "Już jesteś klientem Promocja tylko dla nowych klientów");
  assert.match(text(render({ slug: "a", reason: "karencja", until: null })), /^Karencja trwa Nie spełniasz warunku banku$/);
  assert.match(text(render({ slug: "a", reason: "karencja", until: "2026-12-01" })), /^Karencja trwa Dołączysz od /);
  assert.equal(text(render({ slug: "a", reason: "joined" })), "Masz tę ściągę Postęp w „Moje konto”");
});
