// Tests of the ściąga, the conditions list, the join card and the comments (WP-11 + CHECKCMP).
//
// What is tested here: (1) server-rendered MARKUP - there is no DOM, jsdom or
// testing-library in the runner, so nothing is clicked; keyboard behaviour is
// asserted through the markup that produces it (native checkbox = Space toggles
// it, <label for> = the whole row is the target, aria-disabled instead of
// disabled = still reachable with Tab, live regions present from the first
// render); (2) the PURE functions the components use for their state changes
// (optimistic tick and its revert, the failure message of closing a ściąga,
// comment/reply/like list updates, the comments live-region text).
//
// What is NOT covered by any test in the repo: real key presses, focus movement,
// fetch races and screen-reader announcements. There is no script for them in
// the repo. The WP-11 note that keys were pressed in Chromium cannot be checked
// from here. For CHECKCMP the comments behaviour (a guest's "Odpowiedz" opens
// the sign-in dialog; sorting keeps focus on the sort button and the old list with
// aria-busy; an older, slower answer does not replace a newer one) was run once in
// headless Chromium against the dev server with a mocked comments API; that
// throwaway script was not kept.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PromotionChecklist,
  completeFailureMessage,
  stepsOf,
  withStepChecked
} from "../src/components/PromotionChecklist";
import { ConditionsChecklist } from "../src/components/ConditionsChecklist";
import { JoinChecklistButton } from "../src/components/JoinChecklistButton";
import {
  CommentCard,
  PromotionComments,
  commentsStatus,
  countComments,
  pressedSortOf,
  replyButtonLabel,
  withLikeState,
  withNewComment,
  withReply
} from "../src/components/PromotionComments";
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

test("ściąga: okresy liczone od dnia umowy mają zakres dat z umowy, są otwarte od tego dnia i mówią „etap”", () => {
  const periodStep = (id: string, order: number, rewardCents: number | null, startMonths: number, months: number, label: string) => ({
    id, monthLabel: label, title: rewardCents ? "Odbierz: do 1200 zł" : "Zrób płatności kartą", rewardCents, order,
    periodStartMonths: startMonths, periodMonths: months
  });
  const pkoSteps = [
    { id: "o", monthLabel: "Otwarcie konta", title: "Otwórz konto", rewardCents: null, order: 0 },
    periodStep("p1a", 10, null, 0, 1, "Okres 1 – transakcje kartą"),
    periodStep("p1r", 11, 120000, 0, 1, "Okres 1 – transakcje kartą"),
    periodStep("p2a", 20, null, 1, 1, "Okres 2 – transakcje kartą"),
    periodStep("p2r", 21, 120000, 1, 1, "Okres 2 – transakcje kartą"),
    periodStep("l", 40, null, 0, 3, "Leasing PKO Leasing"),
    periodStep("lr", 41, 50000, 0, 3, "Leasing PKO Leasing")
  ];
  // account opened today: period 1 and the 3-month task are open right away, period 2 is not
  const out = checklist({ trackings: [tracking({ steps: pkoSteps })] });
  const h3 = [...out.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.match(h3[1]!, /^Okres 1 – transakcje kartą \(\d{1,2}\.\d{2}–\d{1,2}\.\d{2}\.\d{4}\)$/);
  assert.match(h3[2]!, /^Okres 2 – transakcje kartą \(/);
  assert.match(h3[3]!, /^Leasing PKO Leasing \(do \d{1,2}\.\d{2}\.\d{4}\)$/);
  assert.equal((out.match(/data-unlocked="true"/g) ?? []).length, 3, "otwarcie, okres 1 i zadanie 3-miesięczne");
  assert.equal((out.match(/data-unlocked="false"/g) ?? []).length, 1, "okres 2 jeszcze zamknięty");
  assert.match(out, /Nagroda za ten etap/);
  assert.doesNotMatch(out, /Nagroda za ten miesiąc/);
  assert.match(out, /kroków tego etapu\./);
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
  assert.match(out, />Kiedy konto zostało otwarte\?<\/label>/);
  assert.match(out, /Czy konto zostało już otwarte\?/);
  assert.doesNotMatch(out, /\/aś|mógł\/mogła/);
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
  assert.match(locked, /Promocja ukończona/);
  assert.doesNotMatch(locked, /\/aś|mógł\/mogła|Twojej historii/);
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

// ---------------------------------------------------------------------------
// Pure functions behind the state changes (CHECKCMP)
// ---------------------------------------------------------------------------

test("ściąga: stepsOf odmienia „kroków” po „z”, withStepChecked nie zmienia oryginału (zaznaczenie i cofnięcie)", () => {
  assert.equal(stepsOf(0, 4), "0 z 4 kroków");
  assert.equal(stepsOf(1, 1), "1 z 1 kroku");
  const base = new Set(["a"]);
  const ticked = withStepChecked(base, "b", true);
  assert.deepEqual([...ticked].sort(), ["a", "b"]);
  assert.deepEqual([...base], ["a"], "oryginał bez zmian (React state)");
  // Optimistic tick followed by the revert after a failed save gives the starting state back.
  assert.deepEqual([...withStepChecked(ticked, "b", false)], ["a"]);
  assert.deepEqual([...withStepChecked(base, "x", false)], ["a"], "odznaczenie nieobecnego kroku nic nie psuje");
});

test("ściąga: błąd sieci przy zamykaniu daje komunikat „Nie udało się zapisać. Sprawdź połączenie.”", () => {
  assert.equal(completeFailureMessage(null, null), "Nie udało się zapisać. Sprawdź połączenie.");
  assert.equal(completeFailureMessage({ ok: true }, { ok: true } as never), null);
  assert.equal(completeFailureMessage({ ok: false }, { error: "Musisz być zalogowany." }), "Musisz być zalogowany.");
  assert.equal(completeFailureMessage({ ok: false }, null), "Coś poszło nie tak.");
  assert.equal(completeFailureMessage({ ok: false }, { error: 42 }), "Coś poszło nie tak.", "nie-tekstowy błąd nie trafia na ekran");
});

const c = (id: string, extra: Partial<Parameters<typeof withNewComment>[1]> = {}) => ({
  id,
  body: `Treść ${id}`,
  createdAt: "2026-10-01T10:00:00.000Z",
  isPinned: false,
  isAdmin: false,
  authorName: "Anna",
  likeCount: 0,
  likedByMe: false,
  ...extra
});

test("komentarze: liczba w nagłówku to komentarze plus odpowiedzi", () => {
  assert.equal(countComments([]), 0);
  assert.equal(countComments([c("a"), c("b", { replies: [c("b1"), c("b2")] })]), 4);
});

test("komentarze: nowy komentarz na górze, odpowiedź pod właściwym rodzicem, polubienie tylko w tym komentarzu", () => {
  const list = [c("a"), c("b", { replies: [c("b1")] })];
  assert.deepEqual(withNewComment(list, c("n")).map((x) => x.id), ["n", "a", "b"]);
  assert.deepEqual(withNewComment(null, c("n")).map((x) => x.id), ["n"], "pierwszy komentarz, gdy lista się nie wczytała");

  const replied = withReply(list, "a", c("a1"));
  assert.deepEqual(replied[0]!.replies!.map((x) => x.id), ["a1"]);
  assert.deepEqual(replied[1]!.replies!.map((x) => x.id), ["b1"]);
  assert.deepEqual(withReply(list, "nie-ma", c("x")), list, "nieznany rodzic nic nie zmienia");
  assert.equal(list[0]!.replies, undefined, "oryginał bez zmian");

  const liked = withLikeState(list, "a", undefined, { likeCount: 3, likedByMe: true });
  assert.equal(liked[0]!.likeCount, 3);
  assert.equal(liked[0]!.likedByMe, true);
  assert.equal(liked[1]!.likeCount, 0);
  const likedReply = withLikeState(list, "b1", "b", { likeCount: 1, likedByMe: true });
  assert.equal(likedReply[1]!.replies![0]!.likeCount, 1);
  assert.equal(likedReply[1]!.likeCount, 0, "rodzic nie dostaje polubienia odpowiedzi");
});

test("komentarze: tekst regionu statusu - pierwsze wczytanie widoczne, ponowne sortowanie tylko dla czytników ekranu", () => {
  assert.deepEqual(commentsStatus({ loading: true, hasLoaded: false, loadFailed: false, sortedBy: null }), {
    text: "Wczytywanie komentarzy...",
    visible: true
  });
  const resort = commentsStatus({ loading: true, hasLoaded: true, loadFailed: false, sortedBy: null });
  assert.equal(resort.visible, false, "stara lista zostaje na ekranie, bez migania napisu");
  assert.match(resort.text, /Sortowanie/);
  assert.equal(commentsStatus({ loading: false, hasLoaded: true, loadFailed: false, sortedBy: "najnowsze" }).text, "Komentarze posortowane: najnowsze.");
  assert.equal(commentsStatus({ loading: false, hasLoaded: true, loadFailed: false, sortedBy: null }).text, "");
  // A failed load is never reported as „Nikt jeszcze nie skomentował”.
  const failed = commentsStatus({ loading: false, hasLoaded: false, loadFailed: true, sortedBy: null });
  assert.equal(failed.visible, true);
  assert.match(failed.text, /Nie udało się wczytać komentarzy/);
  assert.match(commentsStatus({ loading: false, hasLoaded: true, loadFailed: true, sortedBy: null }).text, /poprzednią listę/);
});

// ---------------------------------------------------------------------------
// Live regions are in the DOM from the first render (CHECKCMP)
// ---------------------------------------------------------------------------

test("komentarze: region statusu jest poza kontenerem aria-busy, a kontener listy ma aria-busy", () => {
  const out = render(h(PromotionComments, { promotionSlug: "x", currentUser: null }));
  const status = out.indexOf('role="status"');
  const busy = out.indexOf('aria-busy="true"');
  assert.ok(status > 0 && busy > status, "status przed kontenerem listy");
  // The status node is closed before the busy container opens: they are siblings, not parent and child.
  assert.match(out, /role="status"[^>]*>Wczytywanie komentarzy\.\.\.<\/div><div aria-busy="true">/);
});

test("zapis w ściądze: pusty region role=status jest w DOM, zanim pojawi się „Dodano do ściągi”", () => {
  const form = join({ loggedIn: true });
  assert.match(form, /<div role="status" class="empty:hidden"><\/div>/, "pusty, ukryty region czeka na komunikat");
  assert.doesNotMatch(form, /Dodano do ściągi/);
  const joined = join({ alreadyJoined: true, loggedIn: true });
  assert.match(joined, /<div role="status"[^>]*>.*Dodano do ściągi.*<\/div>/s);
  assert.equal((joined.match(/role="status"/g) ?? []).length, 1, "jeden region na kartę");
});

test("komentarze: przycisk „Odpowiedz” ma nazwę zaczynającą się od widocznego tekstu i wskazującą autora", () => {
  assert.equal(replyButtonLabel("Ala", false, true), "Odpowiedz: Ala");
  assert.equal(replyButtonLabel("Ala", true, true), "Anuluj odpowiedź: Ala");
  assert.equal(replyButtonLabel("Ala", false, false), "Odpowiedz: Ala (wymaga logowania)");

  const card = (authorName: string, canLike: boolean, isReplying = false) =>
    render(
      h(CommentCard, { comment: c("a", { authorName }), canReply: true, isReplying, onToggleReply() {}, onLike() {}, canLike })
    );
  const guest = card("Ala", false);
  assert.match(guest, /aria-label="Odpowiedz: Ala \(wymaga logowania\)"[^>]*>Odpowiedz<\/button>/);
  const user = card("Bartek", true);
  assert.match(user, /aria-label="Odpowiedz: Bartek"[^>]*>Odpowiedz<\/button>/);
  const replying = card("Bartek", true, true);
  assert.match(replying, /aria-label="Anuluj odpowiedź: Bartek"[^>]*>Anuluj<\/button>/);
  // a reply (canReply=false) has no such button
  const reply = render(h(CommentCard, { comment: c("r"), canReply: false, onLike() {}, canLike: true }));
  assert.doesNotMatch(reply, /Odpowiedz/);
});

test("komentarze: po nieudanym ponownym sortowaniu przyciski wracają do ostatnio udanego sortu", () => {
  const base = { appliedSort: "newest", hasLoaded: true } as const;
  assert.equal(pressedSortOf({ ...base, sort: "top", loadFailed: false }), "top", "zwykle: wybrany sort");
  assert.equal(pressedSortOf({ ...base, sort: "top", loadFailed: true }), "newest", "porażka: poprzednia lista");
  // a failed FIRST load has no list to describe: keep the requested sort
  assert.equal(pressedSortOf({ appliedSort: "newest", sort: "top", loadFailed: true, hasLoaded: false }), "top");
});

test("zapis w ściądze: po dołączeniu fokus trafia na link „Otwórz ściągę” zamiast na <body>", () => {
  const src = readFileSync(pathJoin(__dirname, "..", "src", "components", "JoinChecklistButton.tsx"), "utf8");
  assert.match(src, /openLinkRef = useRef<HTMLAnchorElement>/);
  assert.match(src, /<Link ref=\{openLinkRef\} href="\/konto"/);
  assert.match(src, /joinedHere\.current = true;\s*setJoined\(true\)/);
  assert.match(src, /openLinkRef\.current\?\.focus\(\)/);
  // an offer that is already joined on first render must not steal focus
  const out = join({ alreadyJoined: true, loggedIn: true });
  assert.match(out, /Otwórz ściągę/);
});
