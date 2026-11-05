// Zwijane ściągi na /konto, zapamiętany stan, dzwonek przy zbliżającym się terminie (karta + nagłówek + menu mobilne).
//
// Jak w checklist-ui.test.tsx: testujemy ZNACZNIK z renderu serwerowego i czyste funkcje. Nie ma tu DOM-u, więc
// kliknięcie w nagłówek, localStorage i IntersectionObserver tła są sprawdzane w przeglądarce (zob. opis zmiany),
// nie tutaj. Stałe "now" wstrzykujemy propsem, więc testy nie zależą od dzisiejszej daty.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PromotionChecklist, parseOpenIds, sciagaOpenKey, serializeOpenIds } from "../src/components/PromotionChecklist";
import { ChecklistBell, alertsSummary } from "../src/components/ChecklistAlerts";
import { MobileNav } from "../src/components/MobileNav";
import { getMainNav } from "../src/lib/navigation";
import { AuthModalProvider } from "../src/components/AuthModalProvider";
import type { ChecklistAlertItem } from "../src/lib/checklistDeadlines";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} } as never;
const render = (el: ReactElement) =>
  renderToStaticMarkup(h(AppRouterContext.Provider, { value: router }, h(AuthModalProvider, { user: null, children: el })));
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const steps = [
  { id: "s0a", monthLabel: "Otwarcie konta", title: "Złóż wniosek o konto", rewardCents: null, order: 0 },
  { id: "s1a", monthLabel: "Miesiąc 1", title: "Zrób 7 płatności kartą", rewardCents: null, order: 10 },
  { id: "s1b", monthLabel: "Miesiąc 1", title: "Wpłać 1000 zł", rewardCents: null, order: 11 },
  { id: "s1r", monthLabel: "Miesiąc 1", title: "Odbierz: 75 zł", rewardCents: 7500, order: 12 },
  { id: "s2a", monthLabel: "Miesiąc 2", title: "Zrób 7 płatności kartą", rewardCents: null, order: 20 },
  { id: "s2r", monthLabel: "Miesiąc 2", title: "Odbierz: 75 zł", rewardCents: 7500, order: 21 }
];

// Konto otwarte 15.09.2026: październik (grupa 1) zamyka się 1.11.
const tracking = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  promotionId: "p1",
  promotionSlug: "konto-testowe",
  promotionName: "Konto testowe",
  bankName: "Bank Testowy",
  bankLogoUrl: null,
  accountTypeLabel: "Konto osobiste",
  accountOpenedAt: "2026-09-15T00:00:00.000Z",
  steps,
  ...overrides
});

const checklist = (props: Partial<Parameters<typeof PromotionChecklist>[0]> = {}) =>
  render(h(PromotionChecklist, { trackings: [tracking()], initialChecked: [], completedEarnedCents: 0, userId: "u1", ...props }));

const FIVE_DAYS = "2026-10-27T12:00:00Z"; // do końca października 5 dni
const TWO_DAYS = "2026-10-30T12:00:00Z"; // 30.10 w południe: dziś i jutro = 2 dni
const FAR = "2026-10-10T12:00:00Z";

// ---------------------------------------------------------------------------
// Zwijanie
// ---------------------------------------------------------------------------

test("ściąga: domyślnie zwinięta - nagłówek to przycisk z aria-expanded=false i aria-controls na panel, panel jest inert", () => {
  const out = checklist({ now: FAR });
  const button = out.match(/<button[^>]*aria-expanded="[^"]*"[^>]*>/)?.[0];
  assert.ok(button, "przycisk zwijania");
  assert.match(button, /aria-expanded="false"/);
  assert.match(button, /type="button"/);
  const controls = /aria-controls="([^"]+)"/.exec(button)?.[1];
  assert.ok(controls);
  assert.match(out, new RegExp(`<div id="${controls}" inert="">`), "zwinięty panel jest inert (poza tab-em i drzewem dostępności)");
  assert.match(out, /<article[^>]*data-open="false"/);
  assert.match(out, /class="collapse-rows" data-open="false"/);
  // Zawartość jest w DOM (animacja grid-rows), więc pozostałe testy ściągi nadal ją widzą:
  assert.equal((out.match(/<input[^>]*type="checkbox"/g) ?? []).length, 4, "4 kroki są w znaczniku, tylko ukryte");
});

test("ściąga: zwinięty nagłówek mówi, ile zdobyto i ile kroków zrobiono, więc nie trzeba jej rozwijać, żeby wiedzieć, jak idzie", () => {
  const out = checklist({ now: FAR, initialChecked: ["s1a"] });
  const header = text(out.match(/<button[^>]*aria-expanded[^>]*>[\s\S]*?<\/button>/)![0]);
  assert.match(header, /Bank Testowy — Konto testowe/);
  assert.match(header, /Zdobyte dotąd: 0,00 zł|Zdobyte dotąd: 0 zł/);
  assert.match(header, /1 z 4 kroków/);
});

test("ściąga: link „Zobacz promocję” jest poza przyciskiem (link w przycisku byłby błędem), w panelu", () => {
  const out = checklist({ now: FAR });
  const button = out.match(/<button[^>]*aria-expanded[^>]*>[\s\S]*?<\/button>/)![0];
  assert.ok(!button.includes("<a "), "w przycisku nie ma linków");
  assert.match(out, /<a[^>]*href="\/promocje\/konto-testowe"[^>]*>Zobacz promocję/);
});

test("ściąga bez daty otwarcia konta: zwinięta karta przypomina o dacie, bo pole jest w zwiniętym panelu", () => {
  const out = checklist({ trackings: [tracking({ accountOpenedAt: null })], now: FAR });
  const header = text(out.match(/<button[^>]*aria-expanded[^>]*>[\s\S]*?<\/button>/)![0]);
  assert.match(header, /Uzupełnij datę otwarcia konta/);
  assert.match(out, /data-testid="opened-at-prompt"/, "pole z datą nadal jest w panelu");
});

test("ściąga: dwie karty zwijają się niezależnie i biorą różne tony tła (sciaga-0, sciaga-1)", () => {
  const out = checklist({ trackings: [tracking(), tracking({ id: "t2", promotionId: "p2", promotionSlug: "druga" })], now: FAR });
  assert.equal((out.match(/aria-expanded="false"/g) ?? []).length, 2);
  assert.deepEqual([...out.matchAll(/data-ambient-tone="([^"]+)"/g)].map((m) => m[1]), ["sciaga-0", "sciaga-1"]);
  const ids = [...out.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 2, "każda karta ma własny panel");
});

// ---------------------------------------------------------------------------
// Zapamiętany stan
// ---------------------------------------------------------------------------

test("zapamiętany stan: klucz zawiera id użytkownika, a bez niego jest wspólny „anon”", () => {
  assert.equal(sciagaOpenKey("u1"), "bmp:sciaga-open:u1");
  assert.notEqual(sciagaOpenKey("u1"), sciagaOpenKey("u2"));
  assert.equal(sciagaOpenKey(undefined), "bmp:sciaga-open:anon");
});

test("zapamiętany stan: zapisujemy tylko rozwinięte, a śmieci w pamięci oznaczają „wszystko zwinięte”", () => {
  assert.deepEqual([...parseOpenIds('["b","a"]')].sort(), ["a", "b"]);
  for (const bad of [null, undefined, "", "not json", "{}", '"a"', "12", "[1,2]", '[null,{"a":1}]']) {
    assert.equal(parseOpenIds(bad as string | null | undefined).size, 0, String(bad));
  }
  assert.deepEqual([...parseOpenIds('["a",3,"b",null]')].sort(), ["a", "b"], "z mieszanej tablicy zostają napisy");
});

test("zapamiętany stan: zapis odrzuca id ściąg, których użytkownik już nie ma (zakończone), i jest posortowany", () => {
  assert.equal(serializeOpenIds(new Set(["t2", "t1", "gone"]), ["t1", "t2", "t3"]), '["t1","t2"]');
  assert.equal(serializeOpenIds(new Set(), ["t1"]), "[]");
  assert.deepEqual([...parseOpenIds(serializeOpenIds(new Set(["t1"]), ["t1"]))], ["t1"], "zapis i odczyt są odwrotne");
});

// ---------------------------------------------------------------------------
// Dzwonek na karcie
// ---------------------------------------------------------------------------

test("dzwonek na karcie: 5 dni do końca miesiąca i niezaznaczone kroki - notatka w nagłówku (widoczna zwinięta) i przy miesiącu", () => {
  const out = checklist({ now: FIVE_DAYS });
  const header = out.match(/<button[^>]*aria-expanded[^>]*>[\s\S]*?<\/button>/)![0];
  assert.match(header, /data-deadline-note="soon"/, "notatka jest w przycisku, więc widać ją po zwinięciu");
  assert.match(header, /lucide-bell/, "ikona dzwonka");
  const note = text(header);
  assert.match(note, /Zostało 5 dni \(do 31\.10\)/);
  assert.match(note, /Pierwszy miesiąc po otwarciu konta/);
  assert.match(note, /Do zaznaczenia: 2 kroki/);
  assert.match(out, /data-group-deadline="soon"/, "w rozwiniętej karcie ten miesiąc też ma dzwonek");
});

test("dzwonek na karcie: od 2 dni czerwony, a po zaznaczeniu wszystkich kroków miesiąca znika", () => {
  const urgent = checklist({ now: TWO_DAYS });
  assert.match(urgent, /data-deadline-note="urgent"/);
  assert.match(urgent, /Zostały 2 dni/);
  const done = checklist({ now: TWO_DAYS, initialChecked: ["s1a", "s1b"] });
  assert.doesNotMatch(done, /data-deadline-note|data-group-deadline|lucide-bell/);
});

test("dzwonek na karcie: termin dalej niż 7 dni albo brak daty otwarcia konta - bez dzwonka", () => {
  assert.doesNotMatch(checklist({ now: FAR }), /lucide-bell/);
  assert.doesNotMatch(checklist({ trackings: [tracking({ accountOpenedAt: null })], now: FIVE_DAYS }), /data-deadline-note/);
});

// ---------------------------------------------------------------------------
// Dzwonek w nagłówku i w menu
// ---------------------------------------------------------------------------

const item = (overrides: Partial<ChecklistAlertItem> = {}): ChecklistAlertItem => ({
  trackingId: "t1",
  promotionSlug: "konto-testowe",
  promotionName: "Konto testowe",
  bankName: "Bank Testowy",
  groupLabel: "Pierwszy miesiąc po otwarciu konta",
  daysLeft: 5,
  lastDay: "2026-10-31",
  openSteps: 2,
  ...overrides
});

test("dzwonek w nagłówku: pusta lista nic nie renderuje; z listą jest ikona i zdanie dla czytników ekranu", () => {
  assert.equal(renderToStaticMarkup(h(ChecklistBell, { items: [] })), "");
  const one = renderToStaticMarkup(h(ChecklistBell, { items: [item()] }));
  assert.match(one, /data-checklist-bell="soon"/);
  assert.match(one, /lucide-bell/);
  assert.match(one, /<span class="sr-only">Zbliża się termin w ściądze: Bank Testowy, Pierwszy miesiąc po otwarciu konta<\/span>/);
  assert.match(one, /title="Zbliża się termin w ściądze/);
  const many = renderToStaticMarkup(h(ChecklistBell, { items: [item(), item({ trackingId: "t2" })] }));
  assert.match(many, /Zbliżają się terminy w ściądze: 2/);
});

test("dzwonek w nagłówku: czerwony, gdy któryś termin jest za 2 dni lub mniej", () => {
  assert.match(renderToStaticMarkup(h(ChecklistBell, { items: [item({ daysLeft: 2 })] })), /data-checklist-bell="urgent"/);
  assert.match(renderToStaticMarkup(h(ChecklistBell, { items: [item({ daysLeft: 6 }), item({ daysLeft: 1 })] })), /data-checklist-bell="urgent"/);
  assert.equal(alertsSummary([]), "");
});

test("menu mobilne: zalogowany z alertem ma dzwonek przy „Moje konto” i kropkę na zamkniętym przycisku menu", () => {
  const html = renderToStaticMarkup(
    h(MobileNav, { links: getMainNav(), pathname: "/", account: "user", onLogin: () => {}, alerts: [item()] })
  );
  assert.match(html, /data-menu-alert="true"/);
  assert.match(html, /href="\/konto"[^>]*>[\s\S]*Moje konto[\s\S]*data-checklist-bell/);
  assert.match(html, /aria-label="Menu"/, "nazwa przycisku zostaje „Menu”");
});

test("menu mobilne: bez alertów, dla gościa i w trakcie ładowania sesji nie ma ani kropki, ani dzwonka", () => {
  const nav = (account: "user" | "guest" | "loading", alerts: ChecklistAlertItem[]) =>
    renderToStaticMarkup(h(MobileNav, { links: getMainNav(), pathname: "/", account, onLogin: () => {}, alerts }));
  for (const html of [nav("user", []), nav("guest", [item()]), nav("loading", [item()])]) {
    assert.doesNotMatch(html, /data-menu-alert|data-checklist-bell/);
  }
});

// ---------------------------------------------------------------------------
// Tło konta (CSS i znaczniki; sam IntersectionObserver działa tylko w przeglądarce)
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";

const css = readFileSync(pathJoin(process.cwd(), "src/app/globals.css"), "utf8");

test("tło konta: każdy ton z kodu ma regułę w CSS, a zmiana koloru nie animuje się przy reduced motion", () => {
  for (const tone of ["sciaga-0", "sciaga-1", "sciaga-2", "ustawienia", "historia"]) {
    assert.ok(css.includes(`body[data-konto-tone="${tone}"] {`), tone);
  }
  assert.match(css, /\.konto-ambient\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*-1/s, "stała warstwa za stroną");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.konto-ambient\s*\{\s*transition:\s*none/s);
  // Nagłówek podąża za tonem; reguła poza @layer, bo utility `bg-paper/95` wygrywa z warstwą components.
  const headerRule = css.indexOf("\nbody[data-konto-tone] > header {");
  assert.ok(headerRule > 0, "reguła nagłówka istnieje");
  assert.ok(headerRule > css.lastIndexOf("@layer"), "reguła nagłówka stoi po ostatniej warstwie, czyli poza @layer");
});

test("tło konta: strona /konto znakuje sekcje tonami, a ściągi biorą ton z kodu karty", () => {
  const page = readFileSync(pathJoin(process.cwd(), "src/app/konto/page.tsx"), "utf8");
  assert.match(page, /<AccountAmbient \/>/);
  for (const name of ["AMBIENT_START", "AMBIENT_SETTINGS", "AMBIENT_HISTORY"]) {
    assert.ok(page.includes(`data-ambient-tone={${name}}`), name);
  }
  assert.match(page, /userId=\{user\.id\}/, "stan zwinięcia jest zapamiętany per użytkownik");
});
