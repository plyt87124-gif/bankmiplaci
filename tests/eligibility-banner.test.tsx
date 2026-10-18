// Server-render tests of EligibilityBanner (WP-11): four states, readable text
// colours, sign-in prompt for visitors, nothing when there is nothing to say.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { EligibilityBanner } from "../src/components/EligibilityBanner";
import { AuthModalProvider } from "../src/components/AuthModalProvider";
import { computeEligibility } from "../src/lib/services/eligibility";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} } as never;
const render = (el: ReactElement) =>
  renderToStaticMarkup(h(AppRouterContext.Provider, { value: router }, h(AuthModalProvider, { user: { id: "u1", name: "Test" }, children: el })));
const renderGuest = (el: ReactElement) =>
  renderToStaticMarkup(h(AppRouterContext.Provider, { value: router }, h(AuthModalProvider, { user: null, children: el })));
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const NOW = new Date("2026-10-09T10:00:00Z");
const banner = (result: ReturnType<typeof computeEligibility>, extra: Record<string, unknown> = {}) =>
  render(h(EligibilityBanner, { result, bankName: "Bank Testowy", accountType: "PERSONAL", ...extra }));

const NOTE = "Zawsze sprawdź warunki uczestnictwa w regulaminie banku (link w sekcji Źródło).";

test("eligible: „Możesz skorzystać od {data}”, ikona sukcesu, tekst ink-900/700", () => {
  const out = banner(computeEligibility(3, null, new Date("2026-05-01T00:00:00Z"), NOW));
  assert.match(out, /data-eligibility="eligible"/);
  assert.match(text(out), /Możesz skorzystać od 01\.08\.2026/);
  assert.match(out, /text-success/);
  assert.match(text(out), new RegExp(NOTE.replace(/[()]/g, "\\$&")));
  assert.doesNotMatch(out, /text-teal-700|text-gold-600[^"]*"[^>]*>[A-Z]/);
});

test("waiting: karencja trwa - „Karencja do {data}”, ikona zegara, kolor tylko na pasku i ikonie", () => {
  const out = banner(computeEligibility(6, null, new Date("2026-08-01T00:00:00Z"), NOW));
  assert.match(out, /data-eligibility="waiting"/);
  assert.match(text(out), /Karencja do 01\.02\.2027/);
  assert.match(out, /lucide-clock/);
  assert.match(out, /border-l-gold-500/);
});

test("not-eligible: data graniczna - „Prawdopodobnie nie kwalifikujesz się: …”, ikona X", () => {
  const out = banner(computeEligibility(null, new Date("2026-01-01T00:00:00Z"), new Date("2026-06-01T00:00:00Z"), NOW));
  assert.match(out, /data-eligibility="not-eligible"/);
  assert.match(text(out), /Prawdopodobnie nie kwalifikujesz się: konto zamknięte po dacie granicznej/);
  assert.match(out, /lucide-circle-x|lucide-x-circle/);
});

test("unknown: zalogowany bez danych nie dostaje banera", () => {
  assert.equal(banner(computeEligibility(null, null, null, NOW)), "");
  assert.equal(banner(computeEligibility(3, null, null, NOW), { loggedOut: false }), "");
});

test("logged-out: sesja bez użytkownika też pokazuje zaproszenie do logowania", () => {
  const out = renderGuest(h(EligibilityBanner, { result: { status: "unknown" }, bankName: "B", accountType: "PERSONAL" }));
  assert.match(out, /data-eligibility="logged-out"/);
});

test("logged-out: link do modalu logowania (przycisk), także gdy wynik jest „unknown”", () => {
  const out = banner({ status: "unknown" }, { loggedOut: true });
  assert.match(out, /data-eligibility="logged-out"/);
  assert.match(text(out), /Zaloguj się, by sprawdzić, czy możesz skorzystać/);
  assert.match(out, /<button[^>]*>Zaloguj się<\/button>/);
  assert.match(out, /lucide-log-in/);
  assert.match(text(out), new RegExp(NOTE.replace(/[()]/g, "\\$&")));
});

test("baner nie używa zakazanych klas ani kolorowego tekstu stanów", () => {
  for (const out of [
    banner(computeEligibility(3, null, new Date("2026-05-01T00:00:00Z"), NOW)),
    banner(computeEligibility(6, null, new Date("2026-08-01T00:00:00Z"), NOW)),
    banner({ status: "unknown" }, { loggedOut: true })
  ]) {
    assert.doesNotMatch(out, /text-ink-300|border-ink-100|text-\[1[01]px\]|opacity-50/);
    assert.match(out, /text-ink-900/);
  }
});
