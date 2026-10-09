// Server-render tests of the ściąga, the conditions list, the join card and the
// comments (WP-11: presentation and accessibility only). There is no DOM in
// the test runner, so keyboard behaviour is asserted through the markup that
// produces it (native checkbox = Space toggles it, <label for> = whole row is
// the target, aria-disabled instead of disabled = still reachable with Tab);
// the real key presses were checked in Chromium against the dev server.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PromotionChecklist } from "../src/components/PromotionChecklist";
import { ConditionsChecklist } from "../src/components/ConditionsChecklist";
import { JoinChecklistButton } from "../src/components/JoinChecklistButton";
import { PromotionComments } from "../src/components/PromotionComments";
import { AuthModalProvider } from "../src/components/AuthModalProvider";

const router = {
  push() {},
  replace() {},
  refresh() {},
  back() {},
  forward() {},
  prefetch() {}
} as never;

/** Renders inside the app-router + auth-modal contexts the components expect. */
const render = (el: ReactElement) =>
  renderToStaticMarkup(h(AppRouterContext.Provider, { value: router }, h(AuthModalProvider, { user: null, children: el })));
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const FORBIDDEN = /text-ink-300|border-ink-100|bg-ink-solid|text-\[1[01]px\]|opacity-50|animate-ping|toFixed/;

const steps = [
  { id: "s0a", monthLabel: "Otwarcie konta", title: "Złóż wniosek o konto", rewardCents: null, order: 0 },
  { id: "s0b", monthLabel: "Otwarcie konta", title: "Zaakceptuj zgody", rewardCents: null, order: 1 },
  { id: "s1a", monthLabel: "Miesiąc 1", title: "Zrób 7 płatności kartą", rewardCents: null, order: 10 },
  { id: "s1r", monthLabel: "Miesiąc 1", title: "Odbierz: 75 zł", rewardCents: 7500, order: 11 },
  { id: "s2a", monthLabel: "Miesiąc 2", title: "Zrób 7 płatności kartą", rewardCents: null, order: 20 },
  { id: "s2r", monthLabel: "Miesiąc 2", title: "Odbierz: 75 zł", rewardCents: 7500, order: 21 }
];

function tracking(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    promotionId: "p1",
    promotionSlug: "konto-testowe",
    promotionName: "Konto testowe",
    bankName: "Bank Testowy",
    bankLogoUrl: null,
    accountTypeLabel: "Konto osobiste",
    accountOpenedAt: new Date().toISOString(),
    steps,
    ...overrides
  };
}

const checklist = (props: Partial<Parameters<typeof PromotionChecklist>[0]> = {}) =>
  render(
    h(PromotionChecklist, { trackings: [tracking()], initialChecked: [], completedEarnedCents: 0, ...props })
  );

// ---------------------------------------------------------------------------
// PromotionChecklist
// ---------------------------------------------------------------------------

test("ściąga: krok to natywny checkbox z etykietą for/id, bez tabindex i bez atrybutu disabled", () => {
  const out = checklist();
  const inputs = out.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
  assert.equal(inputs.length, 4, "4 kroki (bez wierszy nagród)");
  for (const input of inputs) {
    const id = /id="([^"]+)"/.exec(input)![1];
    assert.ok(out.includes(`for="${id}"`), `label for=${id}`);
    assert.doesNotMatch(input, /tabindex|\sdisabled/);
    assert.match(input, /class="[^"]*\bcheckbox\b/);
  }
  // obszar dotyku: cały wiersz to label o min. 52 px
  assert.match(out, /<label[^>]*min-h-\[3\.25rem\]/);
  assert.doesNotMatch(out, FORBIDDEN);
});

test("ściąga: miesiące to nagłówki h3, jeden wiersz nagrody na miesiąc, przycisk miesiąca min-h-11", () => {
  const out = checklist();
  const h3 = [...out.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(h3, ["Otwarcie konta", "Pierwszy miesiąc po otwarciu konta", h3[2]]);
  assert.equal((out.match(/data-reward=/g) ?? []).length, 2, "dwie grupy mają nagrodę");
  assert.match(out, /Nagroda za ten miesiąc/);
  assert.match(out, /<button[^>]*min-h-11[^>]*>Zaznacz cały miesiąc<\/button>/);
  assert.doesNotMatch(out, /Odznacz/);
});

test("ściąga: zablokowany miesiąc = aria-disabled + ikona Lock + tekst „Odblokuje się dd.mm.rrrr”", () => {
  const out = checklist();
  const group1 = out.split('data-unlocked="false"')[1];
  assert.ok(group1, "jest zablokowany miesiąc");
  const input = /<input[^>]*type="checkbox"[^>]*>/.exec(group1)![0];
  assert.match(input, /aria-disabled="true"/);
  assert.doesNotMatch(input, /\sdisabled/);
  const describedBy = /aria-describedby="([^"]+)"/.exec(input)![1]!;
  const lock = new RegExp(`id="${describedBy.replace(/[:]/g, "\\:")}"[^>]*>(.*?)</p>`).exec(group1);
  assert.ok(lock, "opis wskazuje akapit z datą");
  const lockHtml = lock[1] ?? "";
  assert.match(text(lockHtml), /^Odblokuje się \d{2}\.\d{2}\.\d{4}$/);
  assert.match(lockHtml, /lucide-lock/);
  // miesiąc zablokowany nie ma przycisku zbiorczego i nie jest przezroczysty
  assert.doesNotMatch(group1.split("</div></div>")[0] ?? "", /Zaznacz cały miesiąc/);
  assert.doesNotMatch(out, /opacity-50|disabled:opacity/);
});

test("ściąga: odblokowany miesiąc nie ma aria-disabled; zaznaczenia i postęp pochodzą z initialChecked", () => {
  const out = checklist({ initialChecked: ["s0a"] });
  const first = /<input[^>]*id="[^"]*-s-s0a"[^>]*>/.exec(out)![0];
  assert.match(first, /checked=""/);
  assert.doesNotMatch(first, /aria-disabled="/);
  const bar = /<div role="progressbar"[^>]*>/.exec(out)![0];
  assert.match(bar, /aria-valuemin="0"/);
  assert.match(bar, /aria-valuemax="4"/);
  assert.match(bar, /aria-valuenow="1"/);
  assert.match(bar, /aria-valuetext="1 z 4 kroków"/);
  assert.match(out, /transform:scaleX\(0\.25\)/);
  assert.match(bar, /aria-labelledby=/);
});

test("ściąga: nagroda zdobyta po zaznaczeniu wszystkich kroków miesiąca (logika bez zmian)", () => {
  const out = checklist({ initialChecked: ["s1a"] });
  assert.match(out, /data-reward="unlocked"/);
  assert.match(out, /Nagroda zdobyta/);
  assert.match(out, /Zdobyte dotąd: <span[^>]*>75\s?zł/);
});

test("ściąga: komunikaty o zapisie żyją w regionach role=status, a sekcja ma nagłówek h2", () => {
  const out = checklist();
  assert.ok((out.match(/role="status"/g) ?? []).length >= 3, "region komunikatu + po jednym na miesiąc");
  assert.match(out, /<h2[^>]*>Twoje ściągi z promocji<\/h2>/);
  assert.match(out, /Zaznaczaj kroki/);
});

test("ściąga: bez daty otwarcia konta - etykieta pola daty, następne miesiące czekają na datę", () => {
  const out = checklist({ trackings: [tracking({ accountOpenedAt: null })] as never });
  assert.match(out, /data-testid="opened-at-prompt"/);
  const input = /<input[^>]*type="date"[^>]*>/.exec(out)![0];
  const id = /id="([^"]+)"/.exec(input)![1];
  assert.ok(out.includes(`for="${id}"`));
  assert.match(out, />Data otwarcia konta<\/label>/);
  assert.match(out, /Odblokuje się po podaniu daty otwarcia konta/);
  assert.doesNotMatch(out, FORBIDDEN);
});

test("ściąga: potwierdzenie zamknięcia konta to przycisk <Button>, bez ciemnej płyty z białym tekstem", () => {
  const out = checklist();
  assert.match(out, /<button[^>]*bg-action[^>]*text-on-action[^>]*>Spełniłem\/am warunki/);
  assert.doesNotMatch(out, /bg-ink-solid|bg-teal-700|text-white/);
});

test("ściąga: stan pusty prowadzi do /promocje; emptyState=false nic nie renderuje", () => {
  const empty = checklist({ trackings: [] });
  assert.match(empty, /data-testid="checklist-empty"/);
  assert.match(empty, /<a[^>]*href="\/promocje"[^>]*>Zobacz promocje<\/a>/);
  assert.equal(checklist({ trackings: [], emptyState: false }), "");
});

test("ściąga: brak poziomego rozbicia na szerokość okna (lg:w-screen usunięte)", () => {
  assert.doesNotMatch(checklist(), /w-screen|-mx-\[50vw\]/);
});

// ---------------------------------------------------------------------------
// ConditionsChecklist
// ---------------------------------------------------------------------------

test("lista warunków: numerowana, statyczna, bez checkboxów i przycisków", () => {
  const out = render(
    h(ConditionsChecklist, {
      conditions: [
        { id: "a", title: "Załóż konto", description: "Przez aplikację." },
        { id: "b", title: "Zrób płatność" }
      ]
    })
  );
  assert.match(out, /<ol role="list"/);
  assert.equal((out.match(/<li/g) ?? []).length, 2);
  assert.doesNotMatch(out, /<input|<button|aria-pressed/);
  assert.match(out, /aria-hidden="true"[^>]*>1<\/span>/);
  assert.match(out, /aria-hidden="true"[^>]*>2<\/span>/);
  assert.match(text(out), /1Załóż kontoPrzez aplikację.2Zrób płatność/);
  assert.equal(render(h(ConditionsChecklist, { conditions: [] })), "");
});

// ---------------------------------------------------------------------------
// JoinChecklistButton
// ---------------------------------------------------------------------------

const join = (props: Partial<Parameters<typeof JoinChecklistButton>[0]> = {}) =>
  render(h(JoinChecklistButton, { promotionId: "p1", loggedIn: false, alreadyJoined: false, locked: false, ...props }));

test("zapis w ściądze: etykieta pola daty (htmlFor), przycisk z dopiskiem „wymaga konta” dla gościa", () => {
  const out = join();
  const input = /<input[^>]*type="date"[^>]*>/.exec(out)![0];
  const id = /id="([^"]+)"/.exec(input)![1];
  assert.ok(out.includes(`for="${id}"`));
  assert.match(out, />Kiedy otworzyłeś\/aś konto\?<\/label>/);
  assert.match(out, /Zapisz w ściądze \(wymaga konta\)<\/button>/);
  assert.doesNotMatch(out, FORBIDDEN);
});

test("zapis w ściądze: zalogowany widzi „Zapisz w ściądze”; dwa wystąpienia mają różne id pól", () => {
  assert.match(join({ loggedIn: true }), />Zapisz w ściądze<\/button>/);
  const two = render(h("div", null, h(JoinChecklistButton, { promotionId: "p1", loggedIn: true, alreadyJoined: false, locked: false }), h(JoinChecklistButton, { promotionId: "p1", loggedIn: true, alreadyJoined: false, locked: false })));
  const ids = [...two.matchAll(/<input[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 2);
});

test("zapis w ściądze: stan „Dodano do ściągi” z linkiem do /konto, stan ukończony bez formularza", () => {
  const joined = join({ alreadyJoined: true, loggedIn: true });
  assert.match(joined, /Dodano do ściągi/);
  assert.match(joined, /<a[^>]*href="\/konto"[^>]*>Otwórz ściągę/);
  assert.doesNotMatch(joined, /<input/);
  const locked = join({ locked: true, loggedIn: true });
  assert.match(locked, /Ukończyłeś\/aś tę promocję/);
  assert.doesNotMatch(locked, /<input|<button/);
});

// ---------------------------------------------------------------------------
// PromotionComments
// ---------------------------------------------------------------------------

test("komentarze (gość): zaproszenie do logowania, nota o nieweryfikowanych opiniach, brak formularza", () => {
  const out = render(h(PromotionComments, { promotionSlug: "x", currentUser: null }));
  assert.match(out, /<h2[^>]*>.*Komentarze/);
  assert.match(out, /Opinie użytkowników – nie weryfikujemy ich\. Nie stanowią porady\./);
  assert.match(out, /data-trust-note="comments"/);
  assert.match(out, />Zaloguj się<\/button>/);
  assert.match(out, />Załóż darmowe konto<\/button>/);
  assert.doesNotMatch(out, /<textarea/);
  assert.match(out, /role="status"[^>]*>Wczytywanie komentarzy/);
  assert.doesNotMatch(out, FORBIDDEN);
});

test("komentarze (zalogowany): textarea z ukrytą etykietą sr-only, przycisk wysyłania nieaktywny dla pustej treści", () => {
  const out = render(h(PromotionComments, { promotionSlug: "x", currentUser: { email: "a@b.test", name: "A" } }));
  const area = /<textarea[^>]*>/.exec(out)![0];
  const id = /id="([^"]+)"/.exec(area)![1]!;
  assert.match(out, new RegExp(`<label[^>]*sr-only[^>]*for="${id.replace(/:/g, "\\:")}"|<label[^>]*for="${id.replace(/:/g, "\\:")}"[^>]*sr-only`));
  assert.match(out, />Twój komentarz</);
  assert.match(out, /<button type="submit"[^>]*disabled=""[^>]*>Dodaj komentarz<\/button>/);
});
