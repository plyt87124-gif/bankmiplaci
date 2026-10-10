import test from "node:test";
import assert from "node:assert/strict";
import {
  DESCRIPTION_MAX,
  ENDING_SOON_DESCRIPTION,
  PROMOTION_TITLE_MAX,
  STATIC_PAGE_META,
  bankDescription,
  bankHeading,
  bankTitle,
  buildMetadata,
  endingSoonTitle,
  expiredPromotionTitle,
  formatAmountPlain,
  homeDescription,
  homeTitle,
  hubDescription,
  hubHeading,
  hubTitle,
  makeDescription,
  nameMentionsBank,
  noindexForSearchParams,
  promotionHeading,
  promotionTitle,
  promotionsListDescription,
  promotionsListHeading,
  promotionsListTitle,
  staticPageMetadata
} from "../src/lib/seo/metadata";
import { formatDatePL, warsawMonthYear, warsawYear } from "../src/lib/seo/dates";
import { pluralForm, truncateAtWord } from "../src/lib/seo/text";

/**
 * Offers of the real catalogue (names, banks, account types and maximum
 * bonuses exactly as they are in the database on 2026-10-08), used as the
 * fixture for the uniqueness checks. [bank, name, accountType, maxBonusCents]
 */
const OFFERS: ReadonlyArray<readonly [string, string, string, number]> = [
  ["Alior Bank", "Alior Konto Plus z Premią: do 800 zł + obrączka płatnicza", "PERSONAL", 80000],
  ["Alior Bank", "Alior Konto z Premią + Obrączka płatnicza", "PERSONAL", 80000],
  ["Alior Bank", "Młodzi zyskują: do 500 zł z Alior Kontem (18–25 lat)", "PERSONAL", 50000],
  ["Alior Bank", "Plusy Karty z Plusem (iKonto Biznes)", "BUSINESS", 400000],
  ["mBank", "Cała naprzód – zyskuj z kontem w mBanku (edycja I)", "PERSONAL", 120000],
  ["mBank", "eKonto możliwości (18–24 lata): do 910 zł i 5,3% na oszczędnościach", "YOUNG", 91000],
  ["mBank", "eKonto możliwości 13–17 lat: do 300 zł premii i bonusów", "YOUNG", 30000],
  ["mBank", "Konto firmowe na zawsze za 0 zł (edycja 5)", "BUSINESS", 0],
  ["mBank", "mKonto Intensive: do 1010 zł i 5,5% na oszczędnościach", "PERSONAL", 101000],
  ["mBank", "Załóż firmę i konto w mBanku: 500 zł premii i pakiet płatności", "BUSINESS", 50000],
  ["Revolut", "Darmowy Okres Próbny i Nagroda Pieniężna", "PERSONAL", 10000],
  ["Erste", "Do 600 zł z kontem – korzystaj i zyskaj!", "PERSONAL", 60000],
  ["Erste", "Konto Smart z premią do 700 zł na dowolny cel", "PERSONAL", 70000],
  ["Millennium", "Do 700 zł na Twoje przyjemności z kontem Millennium 360°", "PERSONAL", 100000],
  ["Millennium", "Konto Mój Biznes: bonus do 6000 zł", "BUSINESS", 600000],
  ["Millennium", "Nawet 5000 zł premii z Kontem Mój Biznes", "BUSINESS", 500000],
  ["Credit Agricole", "Kapitalna premia (Konto Biznes)", "BUSINESS", 490000],
  ["Credit Agricole", "Konto dla Ciebie MAX: do 1000 zł zwrotu za gastronomię i do 500 zł za zakupy", "PERSONAL", 150000],
  ["Credit Agricole", "Zwroty za zakupy i restauracje", "PERSONAL", 130000],
  ["Bank Pekao", "Konto Biznes z Żubrem: premia do 5000 zł", "BUSINESS", 500000],
  ["Bank Pekao", "Konto Przekorzystne: do 300 zł + do 2400 zł w Promocji Podróżnej III", "PERSONAL", 270000],
  ["Bank Pekao", "Premia do 4200 zł z Kontem Biznes z Żubrem", "BUSINESS", 420000],
  ["Bank Pekao", "Promocja Podróżna", "PERSONAL", 240000],
  ["Bank Pocztowy", "Konto w Porządku: do 1000 zł zwrotu za zakupy kartą (edycja 2)", "PERSONAL", 100000],
  ["Bank Pocztowy", "Kupujesz - zyskujesz", "PERSONAL", 96000],
  ["PKO Bank Polski", "Letni Bonus – do 900 zł za konto własne i konto dla dziecka", "PERSONAL", 90000],
  ["PKO Bank Polski", "PKO Konto za Zero + Allegro Klik: cashback do 1200 zł", "PERSONAL", 120000],
  ["PKO Bank Polski", "PKO Konto za Zero: Prosty zwrot — do 900 zł (kod PROSTO)", "PERSONAL", 90000],
  ["PKO Bank Polski", "Rozkręć firmę z premią do 5 tys. zł", "BUSINESS", 500000],
  ["BNP Paribas", "Podróżnik - Edycja 1", "PERSONAL", 70000],
  ["BNP Paribas", "Podróżnik z Aplikacją", "PERSONAL", 100000],
  ["BNP Paribas", "Podróżnik z aplikacją 2: do 1100 zł z Kontem Otwartym na Ciebie", "PERSONAL", 110000],
  ["Nest! BANK", "Nest Konto: do 1060 zł za wynagrodzenie i aktywność", "PERSONAL", 106000],
  ["Nest! BANK", "Zyskaj do 1250 zł premii z Nest Kontem", "PERSONAL", 125000],
  ["Nest! BANK", "Zyskaj do 3000 zł premii za wymianę i saldo w euro", "BUSINESS", 300000]
];

const toInput = ([bankName, name, accountType, maxBonusCents]: (typeof OFFERS)[number]) => ({
  bankName,
  name,
  accountType,
  maxBonusCents
});

const NOW = new Date("2026-10-08T10:00:00Z");

/* ---------------- offer titles ---------------- */

test("the plan's example: 'Alior Bank: Konto z Premią — do 800 zł'", () => {
  const title = promotionTitle({ bankName: "Alior Bank", name: "Konto z Premią", accountType: "PERSONAL", maxBonusCents: 80000 });
  assert.equal(title, "Alior Bank: Konto z Premią — do 800 zł");
});

test("every catalogue offer gets a unique title and heading, title <= 60 characters", () => {
  const titles = OFFERS.map((o) => promotionTitle(toInput(o)));
  const headings = OFFERS.map((o) => promotionHeading(toInput(o)));
  for (const [i, title] of titles.entries()) {
    assert.ok(title.length <= PROMOTION_TITLE_MAX, `${title.length} chars: ${title}`);
    assert.ok(title.trim().length > 0, `empty title for ${OFFERS[i]?.[1]}`);
  }
  assert.equal(new Set(titles).size, OFFERS.length, "duplicate titles: " + JSON.stringify(titles));
  assert.equal(new Set(headings).size, OFFERS.length, "duplicate headings");
});

test("the two Alior, two PKO and four mBank personal-type offers differ in title and H1", () => {
  const pick = (bank: string, filter: (type: string) => boolean = () => true) =>
    OFFERS.filter((o) => o[0] === bank && filter(o[2])).slice(0, bank === "mBank" ? 4 : 2);
  for (const group of [pick("Alior Bank"), pick("PKO Bank Polski"), pick("mBank")]) {
    assert.ok(group.length >= 2);
    assert.equal(new Set(group.map((o) => promotionTitle(toInput(o)))).size, group.length);
    assert.equal(new Set(group.map((o) => promotionHeading(toInput(o)))).size, group.length);
  }
});

test("bank name is prefixed only when the offer name does not already contain it", () => {
  const h = (bankName: string, name: string) => promotionHeading({ bankName, name });
  assert.equal(h("Alior Bank", "Alior Konto z Premią + Obrączka płatnicza"), "Alior Konto z Premią + Obrączka płatnicza");
  assert.equal(h("Nest! BANK", "Nest Konto: do 1060 zł"), "Nest Konto: do 1060 zł");
  assert.equal(h("mBank", "Załóż firmę i konto w mBanku"), "Załóż firmę i konto w mBanku"); // declined form
  assert.equal(h("Millennium", "Do 700 zł z kontem Millennium 360°"), "Do 700 zł z kontem Millennium 360°");
  assert.equal(h("PKO Bank Polski", "PKO Konto za Zero"), "PKO Konto za Zero");
  assert.equal(h("Bank Pekao", "Promocja Podróżna"), "Bank Pekao: Promocja Podróżna");
  assert.equal(h("Bank Pocztowy", "Kupujesz - zyskujesz"), "Bank Pocztowy: Kupujesz - zyskujesz");
  assert.equal(h("Credit Agricole", "Zwroty za zakupy"), "Credit Agricole: Zwroty za zakupy");
  assert.equal(h("Erste", "Konto Smart"), "Erste: Konto Smart");
  // A different bank's name is not a match ("mbank" must not match inside "Bank").
  assert.equal(nameMentionsBank("Konto w banku", "mBank"), false);
  assert.equal(nameMentionsBank("Zyskaj z NEST kontem", "Nest! BANK"), true);
});

test("no amount suffix without a cash bonus, and none when the name already states an amount", () => {
  // maxBonusCents = 0 (benefit that is not a cash premium): the name alone.
  assert.equal(
    promotionTitle({ bankName: "mBank", name: "Konto firmowe na zawsze za 0 zł (edycja 5)", accountType: "BUSINESS", maxBonusCents: 0 }),
    "mBank: Konto firmowe na zawsze za 0 zł (edycja 5)"
  );
  assert.equal(promotionTitle({ bankName: "mBank", name: "Konto Start", maxBonusCents: null }), "mBank: Konto Start");
  // The name already says "do 800 zł": repeating it would only add noise.
  assert.equal(
    promotionTitle({ bankName: "Alior Bank", name: "Alior Konto Plus: do 800 zł", maxBonusCents: 80000 }),
    "Alior Konto Plus: do 800 zł"
  );
  // The suffix says "do", never "premii" (could be cashback or a refund).
  const t = promotionTitle({ bankName: "Erste", name: "Konto Smart", maxBonusCents: 70000 });
  assert.equal(t, "Erste: Konto Smart — do 700 zł");
  assert.ok(!/premi/i.test(t));
});

test("business offers get '(konto firmowe)' unless the name already says so", () => {
  assert.equal(
    promotionTitle({ bankName: "Bank Pekao", name: "Premia na start", accountType: "BUSINESS", maxBonusCents: 100000 }),
    "Bank Pekao: Premia na start (konto firmowe) — do 1000 zł"
  );
  for (const name of ["Konto Mój Biznes", "Konto firmowe", "Business Pro"]) {
    assert.ok(!promotionTitle({ bankName: "X", name, accountType: "BUSINESS", maxBonusCents: 0 }).includes("(konto firmowe)"), name);
  }
  assert.ok(!promotionTitle({ bankName: "X", name: "Premia", accountType: "PERSONAL", maxBonusCents: 0 }).includes("firmowe"));
});

test("shortening: the amount goes first, then the business note, then the name (on a word boundary)", () => {
  // 59 chars with the business note, 74 with the amount -> amount dropped only.
  const noAmount = promotionTitle({
    bankName: "Bank Pekao",
    name: "Premia powitalna dla klientów",
    accountType: "BUSINESS",
    maxBonusCents: 100000
  });
  assert.ok(noAmount.length <= 60 && !noAmount.includes("do 1000"), noAmount);
  assert.ok(noAmount.includes("(konto firmowe)"), noAmount);

  // Long name: cut with an ellipsis, no dangling preposition, still unique per name.
  const long = promotionTitle({
    bankName: "PKO Bank Polski",
    name: "Letni Bonus – do 900 zł za konto własne i konto dla dziecka",
    accountType: "PERSONAL",
    maxBonusCents: 90000
  });
  assert.ok(long.length <= 60, long);
  assert.ok(long.startsWith("PKO Bank Polski: Letni Bonus"), long);
  assert.ok(long.endsWith("…"), long);
  assert.ok(!/ (i|z|w|na|do|za)…$/.test(long), long);
});

test("expired offer title keeps the date, whatever the name length", () => {
  const short = expiredPromotionTitle({ bankName: "Alior Bank", name: "Konto z Premią" }, new Date("2026-10-13T00:00:00Z"));
  assert.equal(short, "Alior Bank: Konto z Premią (zakończona 13.10.2026)");
  const long = expiredPromotionTitle(
    { bankName: "PKO Bank Polski", name: "Letni Bonus – do 900 zł za konto własne i konto dla dziecka" },
    "2026-09-30T00:00:00Z"
  );
  assert.ok(long.length <= 65, long);
  assert.ok(long.endsWith("(zakończona 30.09.2026)"), long);
  // Unknown date: still honest.
  assert.ok(expiredPromotionTitle({ bankName: "A", name: "B" }, null).includes("(zakończona)"));
});

test("formatAmountPlain uses plain spaces and keeps grosze when present", () => {
  assert.equal(formatAmountPlain(80000), "800 zł");
  assert.equal(formatAmountPlain(1200000), "12 000 zł");
  assert.equal(formatAmountPlain(1050), "10,50 zł");
  assert.ok(!formatAmountPlain(1200000).includes(" "));
});

/* ---------------- offer descriptions ---------------- */

test("description: summary + 'Ważna do' sentence when it fits", () => {
  const d = makeDescription("Do 800 zł za otwarcie konta i spełnienie warunków.", {
    bankName: "Alior Bank",
    name: "Konto z Premią",
    endDate: new Date("2026-10-13T00:00:00Z"),
    now: NOW
  });
  assert.equal(d, "Do 800 zł za otwarcie konta i spełnienie warunków. Ważna do 13.10.2026.");
});

test("description: adds the missing full stop and says 'Zakończona' after the deadline", () => {
  const d = makeDescription("Premia za wynagrodzenie", {
    bankName: "Erste",
    name: "Konto Smart",
    endDate: new Date("2026-09-30T00:00:00Z"),
    now: NOW
  });
  assert.equal(d, "Premia za wynagrodzenie. Zakończona 30.09.2026.");
  // The last day itself is still 'Ważna do'.
  const lastDay = makeDescription("Premia.", {
    bankName: "Erste",
    name: "Konto Smart",
    endDate: new Date("2026-10-08T00:00:00Z"),
    now: NOW
  });
  assert.equal(lastDay, "Premia. Ważna do 08.10.2026.");
});

test("description: long summaries are cut on a sentence/word boundary and never exceed 160", () => {
  const sentence = "Otwórz konto osobiste, wykonaj kilka płatności kartą i odbierz premię po spełnieniu warunków promocji.";
  const long = `${sentence} ${sentence} ${sentence}`;
  const d = makeDescription(long, { bankName: "B", name: "N", endDate: "2026-12-31T00:00:00Z", now: NOW });
  assert.ok(d.length <= DESCRIPTION_MAX, `${d.length}: ${d}`);
  // Cut after the first full sentence (the 155-char window ends mid-second one), date appended.
  assert.equal(d, `${sentence} Ważna do 31.12.2026.`);

  const noStop = "słowo ".repeat(60);
  const d2 = makeDescription(noStop, { bankName: "B", name: "N", now: NOW });
  assert.ok(d2.length <= DESCRIPTION_MAX && d2.endsWith("…"), d2);
});

test("description: the 'Ważna do' sentence is skipped when it would not fit", () => {
  const summary = "a".repeat(5) + " " + "b".repeat(142) + "."; // 149 + 1 + 20 > 160
  const d = makeDescription(summary, { bankName: "B", name: "N", endDate: "2026-12-31T00:00:00Z", now: NOW });
  assert.equal(d, summary);
  assert.ok(d.length <= DESCRIPTION_MAX);
});

test("description: empty summary falls back to the plan's sentence with the verification date", () => {
  const ctx = {
    bankName: "Alior Bank",
    name: "Konto z Premią",
    lastVerifiedAt: new Date("2026-10-07T08:00:00Z"),
    endDate: new Date("2026-10-13T00:00:00Z"),
    now: NOW
  };
  const expected = "Promocja Alior Bank: Konto z Premią. Warunki krok po kroku, koszty i termin zapisów. Zweryfikowano 07.10.2026.";
  for (const empty of [null, undefined, "", "  \n\t "]) {
    assert.equal(makeDescription(empty, ctx), expected);
  }
  // Unknown verification date: that sentence is dropped, not invented.
  assert.equal(
    makeDescription("", { ...ctx, lastVerifiedAt: null }),
    "Promocja Alior Bank: Konto z Premią. Warunki krok po kroku, koszty i termin zapisów."
  );
  // Very long name: dropped from the fallback so it still fits.
  const veryLong = makeDescription("", { ...ctx, name: "x".repeat(200) });
  assert.ok(veryLong.length <= DESCRIPTION_MAX && veryLong.startsWith("Promocja Alior Bank. "), veryLong);
});

test("description: never longer than 160, whatever the input", () => {
  const words = ["konto", "premia", "karta", "Bank", "zł", "wynagrodzenie", "warunki", "promocja", "1000", "miesiąc"];
  for (let len = 0; len <= 700; len += 7) {
    let text = "";
    for (let i = 0; text.length < len; i++) text += (i % 11 === 10 ? ". " : " ") + words[(i * 7 + len) % words.length];
    const d = makeDescription(text, { bankName: "PKO Bank Polski", name: "Oferta", endDate: "2026-12-31T00:00:00Z", lastVerifiedAt: NOW, now: NOW });
    assert.ok(d.length <= DESCRIPTION_MAX, `len ${len} -> ${d.length}`);
    assert.ok(d.length > 0);
  }
});

/* ---------------- Warsaw calendar, home, lists, hubs ---------------- */

test("'{Miesiąc} {Rok}' and the year come from Poland's calendar, not UTC", () => {
  assert.equal(warsawMonthYear(NOW), "październik 2026");
  // 23:30 UTC on 31 Dec is already 1 Jan in Warsaw.
  const newYear = new Date("2026-12-31T23:30:00Z");
  assert.equal(warsawMonthYear(newYear), "styczeń 2027");
  assert.equal(warsawYear(newYear), 2027);
  assert.equal(warsawMonthYear(new Date("2026-09-30T22:30:00Z")), "październik 2026");
  assert.equal(warsawMonthYear(new Date("2026-09-30T21:30:00Z")), "wrzesień 2026");
});

test("formatDatePL formats dd.mm.rrrr in Warsaw time and rejects garbage", () => {
  assert.equal(formatDatePL(new Date("2026-10-13T00:00:00Z")), "13.10.2026");
  assert.equal(formatDatePL("2026-01-05T23:30:00Z"), "06.01.2026"); // 00:30 CET next day
  assert.equal(formatDatePL(null), null);
  assert.equal(formatDatePL(undefined), null);
  assert.equal(formatDatePL("not a date"), null);
});

test("home title and description follow the plan and fit their limits", () => {
  assert.equal(homeTitle(NOW), "Promocje bankowe 2026 – konta z premią do odebrania | Bankmiplaci");
  assert.ok(homeTitle(NOW).split(" | ")[0]!.length <= 60);
  const d = homeDescription(new Date("2026-10-07T08:00:00Z"));
  assert.ok(d.length <= DESCRIPTION_MAX, `${d.length}: ${d}`);
  assert.ok(d.endsWith("Aktualizacja: 07.10.2026."), d);
  assert.ok(d.startsWith("Aktualne promocje bankowe w Polsce: konta osobiste i firmowe z premią."));
  const noDate = homeDescription(null);
  assert.ok(!noDate.includes("Aktualizacja"));
  assert.ok(noDate.length <= DESCRIPTION_MAX);
});

test("/promocje title, H1 and description, with correct Polish inflection of the count", () => {
  assert.equal(promotionsListTitle(NOW), "Ranking promocji bankowych – październik 2026 | Konta z premią");
  assert.equal(promotionsListHeading(NOW), "Promocje bankowe – październik 2026");
  assert.ok(promotionsListDescription(23).startsWith("Porównanie 23 aktualnych promocji: premia, trudność"));
  assert.ok(promotionsListDescription(1).startsWith("Porównanie 1 aktualnej promocji:"));
  assert.ok(promotionsListDescription(0).startsWith("Porównanie aktualnych promocji:"));
  assert.ok(promotionsListDescription(undefined).startsWith("Porównanie aktualnych promocji:"));
  for (const n of [0, 1, 2, 5, 12, 23, 112]) assert.ok(promotionsListDescription(n).length <= DESCRIPTION_MAX);
});

test("hub, bank and ending-soon builders", () => {
  assert.equal(hubTitle("personal", NOW), "Konta osobiste z premią 2026 – aktualne promocje | Bankmiplaci");
  assert.equal(hubTitle("business", NOW), "Konta firmowe z premią 2026 – promocje dla firm i JDG | Bankmiplaci");
  assert.equal(hubHeading("personal"), "Konta osobiste z premią – aktualne promocje");
  assert.equal(hubHeading("business"), "Konta firmowe z premią – promocje dla przedsiębiorców");
  for (const kind of ["personal", "business"] as const) {
    for (const n of [undefined, 0, 1, 8, 23]) assert.ok(hubDescription(kind, n).length <= DESCRIPTION_MAX, `${kind} ${n}`);
  }

  assert.equal(bankTitle("PKO Bank Polski", NOW), "PKO Bank Polski – promocje i konta z premią 2026 | Bankmiplaci");
  assert.equal(bankHeading("PKO Bank Polski"), "PKO Bank Polski: aktualne promocje bankowe");
  assert.equal(
    bankDescription("Alior Bank", 5),
    "5 aktualnych promocji Alior Bank: konta osobiste i firmowe. Premie, warunki, koszty i terminy zapisów – sprawdź, zanim założysz konto."
  );
  assert.ok(bankDescription("Alior Bank", 1).startsWith("1 aktualna promocja Alior Bank:"));
  assert.ok(bankDescription("Alior Bank", 3).startsWith("3 aktualne promocje Alior Bank:"));
  // The bank page is permanent: with no open offers it must not claim any.
  assert.ok(!/aktualn/i.test(bankDescription("Alior Bank", 0)));
  for (const n of [0, 1, 4, 5, 22]) assert.ok(bankDescription("Credit Agricole", n).length <= DESCRIPTION_MAX);

  assert.equal(endingSoonTitle(NOW), "Promocje bankowe kończące się wkrótce – październik 2026 | Bankmiplaci");
  assert.ok(ENDING_SOON_DESCRIPTION.length <= DESCRIPTION_MAX);
});

test("static page titles follow the plan; descriptions fit and are non-empty", () => {
  assert.equal(STATIC_PAGE_META.porownaj.title, "Porównanie promocji bankowych – tabela premii i opłat");
  assert.equal(STATIC_PAGE_META.quiz.title, "Quiz: dobierz promocję bankową do siebie");
  assert.equal(STATIC_PAGE_META.faq.title, "Najczęstsze pytania o promocje bankowe");
  assert.equal(STATIC_PAGE_META.metodologia.title, "Jak liczymy ocenę serwisu");
  assert.equal(STATIC_PAGE_META.oNas.title, "O nas i zasady redakcyjne");
  assert.equal(STATIC_PAGE_META.blog.title, "Poradniki o promocjach bankowych i kontach z premią");
  for (const [key, meta] of Object.entries(STATIC_PAGE_META)) {
    assert.ok(meta.description.length > 40 && meta.description.length <= DESCRIPTION_MAX, key);
    assert.ok(meta.path.startsWith("/"), key);
    // The page named "Premia" is gone: never the brand.
    assert.ok(!/na Premii/.test(meta.description), key);
  }
  const md = staticPageMetadata("faq");
  assert.match(String(md.alternates?.canonical), /\/faq$/);
});

/* ---------------- buildMetadata ---------------- */

test("buildMetadata: absolute canonical, og:url = canonical, pl_PL, siteName, explicit images, no robots by default", () => {
  const md = buildMetadata({ title: "Test", description: "  Opis \n strony ", path: "/promocje/x" });
  const canonical = md.alternates?.canonical as string;
  assert.match(canonical, /^https?:\/\/[^/]+\/promocje\/x$/);
  assert.equal(md.title, "Test");
  assert.equal(md.description, "Opis strony");
  const og = md.openGraph as Record<string, unknown>;
  assert.equal(og.url, canonical);
  assert.equal(og.locale, "pl_PL");
  assert.equal(og.type, "website");
  assert.equal(og.siteName, "Bankmiplaci");
  assert.equal(og.title, "Test");
  assert.ok(Array.isArray(og.images) && (og.images as Array<{ url: string }>)[0]!.url.endsWith("/opengraph-image"));
  assert.equal((md.twitter as Record<string, unknown>).card, "summary_large_image");
  assert.equal(md.robots, undefined);
});

test("buildMetadata: absolute titles, article dates, custom image and noindex", () => {
  const md = buildMetadata({
    title: { absolute: "Pełny tytuł | Bankmiplaci" },
    description: "Opis",
    path: "/blog/a",
    type: "article",
    image: "/img/a.png",
    publishedTime: new Date("2026-10-01T08:00:00Z"),
    modifiedTime: "garbage",
    noindex: true
  });
  assert.deepEqual(md.title, { absolute: "Pełny tytuł | Bankmiplaci" });
  const og = md.openGraph as Record<string, unknown>;
  assert.equal(og.title, "Pełny tytuł | Bankmiplaci");
  assert.equal(og.type, "article");
  assert.equal(og.publishedTime, "2026-10-01T08:00:00.000Z");
  assert.equal("modifiedTime" in og, false);
  assert.ok((og.images as Array<{ url: string }>)[0]!.url.endsWith("/img/a.png"));
  assert.ok(((og.images as Array<{ url: string }>)[0]!.url).startsWith("http"));
  assert.deepEqual(md.robots, { index: false, follow: true });

  const explicit = buildMetadata({ title: "T", description: "D", path: "/p", noindex: true, robots: { index: true, follow: false } });
  assert.deepEqual(explicit.robots, { index: true, follow: false });
});

/* ---------------- parameterised URLs ---------------- */

test("noindexForSearchParams: filters, sort and page > 1 are noindex,follow", () => {
  const noindex = { index: false, follow: true };
  assert.equal(noindexForSearchParams({}), undefined);
  assert.equal(noindexForSearchParams(undefined), undefined);
  for (const key of ["sort", "bank", "q", "difficulty", "accountType", "niedostepna", "minBonus", "noFees", "typ", "liczba"]) {
    assert.deepEqual(noindexForSearchParams({ [key]: "x" }), noindex, key);
  }
  assert.deepEqual(noindexForSearchParams({ strona: "2" }), noindex);
  assert.deepEqual(noindexForSearchParams({ strona: "17" }), noindex);
  assert.deepEqual(noindexForSearchParams({ sort: ["top-rated", "newest"] }), noindex);
  assert.deepEqual(noindexForSearchParams(new URLSearchParams("bank=pko")), noindex);
});

test("noindexForSearchParams: empty values, page 1, junk page and tracking params keep the page indexable", () => {
  assert.equal(noindexForSearchParams({ sort: "", q: "  ", bank: undefined }), undefined);
  assert.equal(noindexForSearchParams({ strona: "1" }), undefined);
  assert.equal(noindexForSearchParams({ strona: "0" }), undefined);
  assert.equal(noindexForSearchParams({ strona: "abc" }), undefined);
  assert.equal(noindexForSearchParams({ utm_source: "tiktok", utm_medium: "social", ref: "x", gclid: "y" }), undefined);
  assert.equal(noindexForSearchParams(new URLSearchParams("utm_source=a&strona=1")), undefined);
  // Pages can add their own filter keys.
  assert.deepEqual(noindexForSearchParams({ typ_konta: "x" }, ["typ_konta"]), { index: false, follow: true });
});

/* ---------------- text helpers ---------------- */

test("pluralForm implements the Polish rule", () => {
  const f = (n: number) => pluralForm(n, "promocja", "promocje", "promocji");
  const cases: Array<[number, string]> = [
    [0, "promocji"], [1, "promocja"], [2, "promocje"], [3, "promocje"], [4, "promocje"], [5, "promocji"],
    [11, "promocji"], [12, "promocji"], [13, "promocji"], [14, "promocji"], [21, "promocji"], [22, "promocje"],
    [23, "promocje"], [24, "promocje"], [25, "promocji"], [100, "promocji"], [101, "promocji"], [102, "promocje"],
    [112, "promocji"], [122, "promocje"]
  ];
  for (const [n, expected] of cases) assert.equal(f(n), expected, String(n));
});

test("truncateAtWord respects the limit, word boundaries and dangling words", () => {
  assert.equal(truncateAtWord("krótki tekst", 50), "krótki tekst");
  const t = truncateAtWord("Konto osobiste z premią za wynagrodzenie i płatności kartą", 30);
  assert.ok(t.length <= 30, t);
  assert.ok(t.endsWith("…"));
  assert.ok(!/\s…$/.test(t));
  assert.equal(truncateAtWord("jedno ".repeat(10), 12).length <= 12, true);
  // A single huge word is hard-cut instead of returning only the ellipsis.
  const hard = truncateAtWord("x".repeat(100), 20);
  assert.equal(hard.length, 20);
  for (let max = 5; max < 80; max++) {
    assert.ok(truncateAtWord("Letni Bonus – do 900 zł za konto własne i konto dla dziecka", max).length <= max, String(max));
  }
});
