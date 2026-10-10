// WP-10: the pure decisions of the offer page (state, fees, deadline, cooldown,
// FAQ, structured data). No database, no React rendering.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import {
  BANK_OFFERS_LIMIT,
  BANK_OFFERS_LIMIT_ENDED,
  bankOffersListHref,
  cooldownRule,
  cooldownSentences,
  cooldownShort,
  deriveOfferState,
  labelWithoutAmount,
  methodologyHref,
  normalizeRef,
  pickBankOffers,
  remainingDaysText,
  reportErrorHref,
  safeHttpUrl,
  splitLines,
  termFact
} from "../src/components/promocja/offerModel";
import { buildOfferFaq, type OfferFaqInput } from "../src/components/promocja/offerFaq";
import { buildOfferStructuredData } from "../src/components/promocja/offerStructuredData";
import { isAffiliateLinkLive } from "../src/lib/promotionAvailability";
import { serializeJsonLd } from "../src/lib/seo/jsonld";

// 9 Oct 2026, noon in Warsaw.
const NOW = new Date("2026-10-09T10:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const nbsp = (s: string) => s.replace(/ /g, " ");

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

test("state: open ACTIVE offer with a live partner link shows the CTA", () => {
  const s = deriveOfferState({ status: "ACTIVE", endDate: day("2026-10-31"), affiliateLinkEnabled: true }, NOW);
  assert.deepEqual(s, {
    draft: false,
    deadlinePassed: false,
    notPromoted: false,
    expired: false,
    affiliateOff: false,
    ctaLive: true
  });
});

test("state: the last day itself is still open (Polish calendar)", () => {
  const s = deriveOfferState({ status: "ACTIVE", endDate: day("2026-10-09"), affiliateLinkEnabled: true }, NOW);
  assert.equal(s.deadlinePassed, false);
  assert.equal(s.ctaLive, true);
});

test("state: ACTIVE row past its deadline (cron not run yet) is ended, CTA off", () => {
  const s = deriveOfferState({ status: "ACTIVE", endDate: day("2026-09-30"), affiliateLinkEnabled: true }, NOW);
  assert.equal(s.deadlinePassed, true);
  assert.equal(s.expired, true);
  assert.equal(s.notPromoted, false);
  assert.equal(s.ctaLive, false);
});

test("state: EXPIRED/ARCHIVED before the bank's deadline = not promoted by us (different wording, CTA off)", () => {
  for (const status of ["EXPIRED", "ARCHIVED"]) {
    const s = deriveOfferState({ status, endDate: day("2026-12-31"), affiliateLinkEnabled: true }, NOW);
    assert.equal(s.notPromoted, true, status);
    assert.equal(s.deadlinePassed, false, status);
    assert.equal(s.expired, true, status);
    assert.equal(s.ctaLive, false, status);
  }
});

test("state: current offer whose partner link is switched off = affiliateOff, no CTA", () => {
  const s = deriveOfferState({ status: "ACTIVE", endDate: day("2026-10-31"), affiliateLinkEnabled: false }, NOW);
  assert.equal(s.affiliateOff, true);
  assert.equal(s.expired, false);
  assert.equal(s.ctaLive, false);
});

test("state: an ended offer is never 'affiliateOff' (one reason is shown)", () => {
  const s = deriveOfferState({ status: "EXPIRED", endDate: day("2026-09-01"), affiliateLinkEnabled: false }, NOW);
  assert.equal(s.affiliateOff, false);
  assert.equal(s.expired, true);
});

test("state: DRAFT keeps the CTA so the admin preview looks like the final page", () => {
  const s = deriveOfferState({ status: "DRAFT", endDate: day("2026-10-31"), affiliateLinkEnabled: true }, NOW);
  assert.equal(s.draft, true);
  assert.equal(s.ctaLive, true);
});

test("state: ctaLive is exactly what /out/[slug] allows (isAffiliateLinkLive) - except a DRAFT, kept for the admin preview", () => {
  const statuses = ["ACTIVE", "EXPIRED", "ARCHIVED", "DRAFT"];
  const endDates = ["2026-09-30", "2026-10-08", "2026-10-09", "2026-10-31"]; // ended, yesterday, today (last day), ahead
  for (const status of statuses) {
    for (const end of endDates) {
      for (const affiliateLinkEnabled of [true, false]) {
        const input = { status, endDate: day(end), affiliateLinkEnabled };
        const state = deriveOfferState(input, NOW);
        const label = `${status} ${end} affiliate=${affiliateLinkEnabled}`;
        if (status === "DRAFT") {
          // /out/ turns a DRAFT away; the page still shows the button to the admin while the offer is open.
          assert.equal(isAffiliateLinkLive(input, NOW), false, label);
          assert.equal(state.ctaLive, !state.deadlinePassed && affiliateLinkEnabled, label);
        } else {
          assert.equal(state.ctaLive, isAffiliateLinkLive(input, NOW), label);
        }
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* Deadline                                                            */
/* ------------------------------------------------------------------ */

test("remainingDaysText: the verb agrees with the number", () => {
  assert.equal(remainingDaysText(1), "został 1 dzień");
  assert.equal(remainingDaysText(2), "zostały 2 dni");
  assert.equal(remainingDaysText(4), "zostały 4 dni");
  assert.equal(remainingDaysText(5), "zostało 5 dni");
  assert.equal(remainingDaysText(12), "zostało 12 dni");
  assert.equal(remainingDaysText(22), "zostały 22 dni");
  assert.equal(remainingDaysText(25), "zostało 25 dni");
});

test("termFact: date plus days left, tone follows the 14 / 3 day thresholds", () => {
  const open = termFact(day("2026-10-31"), NOW);
  assert.equal(open.primary, "do 31.10.2026");
  assert.equal(open.secondary, "zostały 22 dni");
  assert.equal(open.tone, "neutral");

  const soon = termFact(day("2026-10-20"), NOW);
  assert.equal(soon.tone, "warn");
  assert.equal(soon.secondary, "zostało 11 dni");

  const urgent = termFact(day("2026-10-12"), NOW);
  assert.equal(urgent.tone, "danger");
  assert.equal(urgent.secondary, "zostały 3 dni");
});

test("termFact: the last day, an ended offer and a missing date", () => {
  const last = termFact(day("2026-10-09"), NOW);
  assert.equal(last.primary, "do 09.10.2026");
  assert.equal(last.secondary, "ostatni dzień zapisów");
  assert.equal(last.tone, "danger");

  const ended = termFact(day("2026-09-30"), NOW);
  assert.equal(ended.primary, "Zakończona 30.09.2026");
  assert.equal(ended.secondary, null);
  assert.equal(ended.tone, "danger");

  const missing = termFact(null, NOW);
  assert.equal(missing.primary, "Brak danych");
  assert.equal(missing.tone, "neutral");
});

/* ------------------------------------------------------------------ */
/* Cooldown                                                            */
/* ------------------------------------------------------------------ */

test("cooldownRule: none, months only, cut-off only, both; junk is ignored", () => {
  assert.equal(cooldownRule({ cooldownMonths: null, cooldownCutoffDate: null }), null);
  assert.equal(cooldownRule({}), null);
  assert.deepEqual(cooldownRule({ cooldownMonths: 36 }), { months: 36, cutoff: null });
  assert.equal(cooldownRule({ cooldownCutoffDate: day("2024-08-01") })?.cutoff?.toISOString(), "2024-08-01T00:00:00.000Z");
  assert.equal(cooldownRule({ cooldownCutoffDate: "not a date" }), null);
  // 0 months is a rule ("no extra waiting time"), not "no rule".
  assert.deepEqual(cooldownRule({ cooldownMonths: 0 }), { months: 0, cutoff: null });
});

test("cooldownShort and cooldownSentences use the stored values only", () => {
  assert.equal(cooldownShort({ months: 36, cutoff: null }), "Karencja 36 mies.");
  assert.equal(cooldownShort({ months: 0, cutoff: null }), "Bez karencji");
  assert.equal(cooldownShort({ months: null, cutoff: day("2024-08-01") }), "Bez konta w banku od 01.08.2024");
  // a stored date is a concrete requirement: it wins over "0 months", "Bez karencji" only without a date
  assert.equal(cooldownShort({ months: 0, cutoff: day("2024-08-01") }), "Bez konta w banku od 01.08.2024");
  assert.equal(cooldownShort({ months: 36, cutoff: day("2024-08-01") }), "Karencja 36 mies.");

  const months = cooldownSentences({ months: 36, cutoff: null }, "Alior Bank");
  assert.equal(months.length, 1);
  assert.match(months[0] ?? "", /w ciągu ostatnich 36 miesięcy \(3 lat\) przed złożeniem wniosku nie miałeś\/aś konta w banku Alior Bank/);

  const both = cooldownSentences({ months: 24, cutoff: day("2024-12-31") }, "Erste");
  assert.equal(both.length, 2);
  assert.match(both[0] ?? "", /od 31\.12\.2024/);

  assert.match(cooldownSentences({ months: 0, cutoff: null }, "mBank")[0] ?? "", /nie obowiązuje dodatkowy okres karencji/);
});

/* ------------------------------------------------------------------ */
/* Text / url helpers                                                  */
/* ------------------------------------------------------------------ */

test("splitLines: bullets and numbering are stripped, a single line stays one entry", () => {
  assert.deepEqual(splitLines(null), []);
  assert.deepEqual(splitLines(""), []);
  assert.deepEqual(splitLines("Osoby pełnoletnie. Nowi klienci."), ["Osoby pełnoletnie. Nowi klienci."]);
  assert.deepEqual(splitLines("- jedna\n• dwie\r\n3. trzy\n\n  \n* cztery"), ["jedna", "dwie", "trzy", "cztery"]);
  // a number that belongs to the sentence is not a list marker
  assert.deepEqual(splitLines("3 lata bez konta"), ["3 lata bez konta"]);
});

test("labelWithoutAmount: cuts a trailing amount that equals the part's amount, nothing else", () => {
  // the shapes found in the stored labels
  assert.equal(
    labelWithoutAmount("Nagroda za 1. miesiąc po złożeniu wniosku — 200 zł", 20000),
    "Nagroda za 1. miesiąc po złożeniu wniosku"
  );
  assert.equal(labelWithoutAmount("Premia I – 50 zł", 5000), "Premia I");
  assert.equal(labelWithoutAmount("Premia I - 50 zł", 5000), "Premia I");
  assert.equal(labelWithoutAmount("Nagroda (200 zł)", 20000), "Nagroda");
  assert.equal(labelWithoutAmount("Premia — 10,50 zł", 1050), "Premia");
  assert.equal(labelWithoutAmount("Kantor — 1 200 zł", 120000), "Kantor");
  assert.equal(labelWithoutAmount("Kantor — 1200 zł", 120000), "Kantor");
  assert.equal(labelWithoutAmount("Kantor — 1 200 zł", 120000), "Kantor"); // no-break spaces, as Intl writes them
  assert.equal(labelWithoutAmount("Kantor — 1 200 zł", 120000), "Kantor");
  assert.equal(labelWithoutAmount("Bonus — 100zł", 10000), "Bonus");
  // a different amount, a qualifier, a part of a bigger number, or an amount in the middle stays as stored
  assert.equal(labelWithoutAmount("Nagroda III stopnia (4× 100 zł)", 40000), "Nagroda III stopnia (4× 100 zł)");
  assert.equal(labelWithoutAmount("Zwrot 5% — do 120 zł", 12000), "Zwrot 5% — do 120 zł");
  assert.equal(labelWithoutAmount("Nagroda — 1200 zł", 20000), "Nagroda — 1200 zł");
  assert.equal(labelWithoutAmount("Nagroda — 200 zł", 2000), "Nagroda — 200 zł");
  assert.equal(labelWithoutAmount("Nagroda — 200 zł za wniosek", 20000), "Nagroda — 200 zł za wniosek");
  assert.equal(labelWithoutAmount("Nagrody III stopnia — 4 × 100 zł", 40000), "Nagrody III stopnia — 4 × 100 zł");
  // an amount before a closing remark in parentheses is cut, the remark stays
  assert.equal(
    labelWithoutAmount("Nagroda na start I stopnia — 200 zł (+ obrączka płatnicza, nagroda rzeczowa)", 20000),
    "Nagroda na start I stopnia (+ obrączka płatnicza, nagroda rzeczowa)"
  );
  assert.equal(
    labelWithoutAmount("Premia I — 100 zł (wpływ w 7 dni, transakcje 350 zł, saldo Moje cele)", 10000),
    "Premia I (wpływ w 7 dni, transakcje 350 zł, saldo Moje cele)"
  );
  assert.equal(labelWithoutAmount("Premia I — 100 zł (wpływ)", 20000), "Premia I — 100 zł (wpływ)"); // not this part's amount
  assert.equal(labelWithoutAmount("— 100 zł (wpływ)", 10000), "— 100 zł (wpływ)"); // nothing would be left of the label
  // nothing left of the label -> the label is kept whole; junk amounts change nothing
  assert.equal(labelWithoutAmount("200 zł", 20000), "200 zł");
  assert.equal(labelWithoutAmount("Nagroda — 200 zł", 0), "Nagroda — 200 zł");
  assert.equal(labelWithoutAmount("  Nagroda   I  ", 20000), "Nagroda I");
});

test("safeHttpUrl: only http(s) reaches an href", () => {
  assert.equal(safeHttpUrl("https://www.aliorbank.pl/regulamin.pdf"), "https://www.aliorbank.pl/regulamin.pdf");
  assert.equal(safeHttpUrl("http://example.com"), "http://example.com/");
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,<b>x</b>"), null);
  assert.equal(safeHttpUrl("//evil.example"), null);
  assert.equal(safeHttpUrl("aliorbank.pl"), null);
  assert.equal(safeHttpUrl(""), null);
  assert.equal(safeHttpUrl(null), null);
});

test("normalizeRef: first value, trimmed, capped", () => {
  assert.equal(normalizeRef(undefined), undefined);
  assert.equal(normalizeRef("  "), undefined);
  assert.equal(normalizeRef(" tok123 "), "tok123");
  assert.equal(normalizeRef(["a", "b"]), "a");
  assert.equal(normalizeRef("x".repeat(500))?.length, 120);
});

test("links: methodology, report-error and bank list targets", () => {
  assert.equal(methodologyHref(true), "/metodologia");
  assert.equal(methodologyHref(true, "weryfikacja"), "/metodologia#weryfikacja");
  assert.equal(methodologyHref(false), "/jak-zarabiamy#ocena");
  assert.equal(reportErrorHref("alior-konto-z-premia"), "/kontakt?oferta=alior-konto-z-premia");
  assert.equal(bankOffersListHref("pko", false), "/promocje?bank=pko");
  assert.equal(bankOffersListHref("pko", true), "/banki/pko");
});

test("pickBankOffers: excludes the current offer; an ended offer gets the same account type first, max 3", () => {
  const cards = [
    { slug: "a", accountType: "BUSINESS" },
    { slug: "cur", accountType: "PERSONAL" },
    { slug: "b", accountType: "PERSONAL" },
    { slug: "c", accountType: "PERSONAL" },
    { slug: "d", accountType: "BUSINESS" },
    { slug: "e", accountType: "PERSONAL" }
  ];
  const current = { slug: "cur", accountType: "PERSONAL" };
  assert.deepEqual(
    pickBankOffers(cards, current, false).map((c) => c.slug),
    ["a", "b", "c", "d"].slice(0, BANK_OFFERS_LIMIT)
  );
  const ended = pickBankOffers(cards, current, true).map((c) => c.slug);
  assert.equal(ended.length, BANK_OFFERS_LIMIT_ENDED);
  assert.deepEqual(ended, ["b", "c", "e"]);
  assert.deepEqual(pickBankOffers([{ slug: "cur", accountType: "PERSONAL" }], current, true), []);
});

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

const FAQ_BASE: OfferFaqInput = {
  name: "Alior Konto z Premią",
  bankName: "Alior Bank",
  maxBonusCents: 80000,
  bonusParts: [
    { label: "Nagroda I", amountCents: 20000 },
    { label: "Nagroda II", amountCents: 60000 }
  ],
  conditions: [{ title: "Otwórz konto." }, { title: "Zaloguj się do aplikacji" }],
  endDate: day("2026-10-31"),
  ended: false,
  cooldown: { months: 36, cutoff: null },
  eligibleFor: "Nowi klienci.",
  fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 600, cardFeeWaiverCondition: "min. 300 zł płatności" },
  lastVerifiedAt: new Date("2026-10-07T08:00:00Z"),
  verificationHref: "/metodologia#weryfikacja"
};

test("FAQ: six questions with answers, built from the fields", () => {
  const items = buildOfferFaq(FAQ_BASE);
  assert.equal(items.length, 6);
  for (const item of items) {
    assert.ok(item.question.endsWith("?"), item.question);
    assert.ok(item.answer.length > 20, item.question);
  }
  const text = nbsp(items.map((i) => `${i.question} ${i.answer}`).join("\n"));
  assert.match(text, /Maksymalnie 800 zł/);
  assert.match(text, /Nagroda I – 200 zł; Nagroda II – 600 zł/);
  assert.match(text, /warunki są takie: Otwórz konto; Zaloguj się do aplikacji/);
  assert.match(text, /Do 31\.10\.2026/);
  assert.match(text, /36 miesięcy/);
  assert.match(text, /Opłata za konto: 0 zł\. Opłata za kartę: 6 zł \(0 zł po spełnieniu warunku: min\. 300 zł płatności\)\./);
  assert.match(text, /Ostatnia weryfikacja: 07\.10\.2026/);
});

test("FAQ: no countdown wording (the text may be cached and is written to JSON-LD)", () => {
  const text = buildOfferFaq(FAQ_BASE).map((i) => i.answer).join(" ");
  assert.doesNotMatch(text, /zosta(ł|ły|ło) \d+ (dzień|dni)/);
});

test("FAQ: empty fields say 'sprawdź w regulaminie banku' instead of inventing", () => {
  const items = buildOfferFaq({
    ...FAQ_BASE,
    bonusParts: [],
    conditions: [],
    cooldown: null,
    eligibleFor: null,
    fees: null,
    lastVerifiedAt: null
  });
  const joined = nbsp(items.map((i) => i.answer).join("\n"));
  assert.match(items[1]?.answer ?? "", /Nie mamy jeszcze rozpisanych warunków.*regulaminie banku/);
  assert.match(items[3]?.answer ?? "", /nie ma informacji o karencji.*regulaminie banku/);
  assert.match(items[4]?.answer ?? "", /Opłata za konto: brak danych – sprawdź tabelę opłat banku\. Opłata za kartę: brak danych/);
  assert.match(items[5]?.answer ?? "", /Nie mamy zapisanej daty ostatniej weryfikacji/);
  assert.doesNotMatch(joined, /Opłata za konto: 0 zł/);
});

test("FAQ: an offer without a cash premium and an ended offer are worded for what they are", () => {
  const noCash = buildOfferFaq({ ...FAQ_BASE, maxBonusCents: 0, bonusParts: [] });
  assert.match(noCash[0]?.answer ?? "", /nie ma premii gotówkowej/);
  assert.doesNotMatch(noCash[0]?.answer ?? "", /Maksymalnie/);

  const ended = buildOfferFaq({ ...FAQ_BASE, ended: true, endDate: day("2026-09-30") });
  assert.equal(ended[2]?.question, "Czy ta promocja jeszcze trwa?");
  assert.match(ended[2]?.answer ?? "", /zapisy zakończyły się 30\.09\.2026/);
});

test("FAQ: the cooldown answer explains the term only for a monthly rule", () => {
  const monthly = buildOfferFaq(FAQ_BASE)[3]?.answer ?? "";
  assert.match(monthly, /Karencja to okres/);
  const cutoffOnly = buildOfferFaq({ ...FAQ_BASE, cooldown: { months: null, cutoff: day("2024-08-01") } })[3]?.answer ?? "";
  assert.doesNotMatch(cutoffOnly, /Karencja to okres/);
  assert.match(cutoffOnly, /od 01\.08\.2024/);
});

test("FAQ: a part label that already ends with its amount does not print it twice", () => {
  const items = buildOfferFaq({
    ...FAQ_BASE,
    maxBonusCents: 40000,
    bonusParts: [
      { label: "Nagroda za 1. miesiąc po złożeniu wniosku — 200 zł", amountCents: 20000 },
      { label: "Nagroda za 2. miesiąc (200 zł)", amountCents: 20000 }
    ]
  });
  const answer = nbsp(items[0]?.answer ?? "");
  assert.match(answer, /Nagroda za 1\. miesiąc po złożeniu wniosku – 200 zł; Nagroda za 2\. miesiąc – 200 zł\./);
  assert.doesNotMatch(answer, /200 zł – 200 zł|— 200 zł|\(200 zł\)/);
});

test("FAQ: the steps are our write-up of the terms, not a quotation of the regulation", () => {
  const answer = buildOfferFaq(FAQ_BASE)[1]?.answer ?? "";
  assert.match(answer, /^Według naszego opisu promocji warunki są takie: Otwórz konto; Zaloguj się do aplikacji\./);
  // no numbering: the list holds rules and limits next to actions and the data cannot tell them apart (see offerFaq.ts)
  assert.doesNotMatch(answer, /\d\) /);
  assert.match(answer, /Lista może zawierać także dodatkowe zasady i ograniczenia/);
  assert.doesNotMatch(answer, /Według regulaminu/);
  assert.match(answer, /wiążące zasady w regulaminie banku/);
});

test("FAQ: free-text eligibility lines become separate sentences", () => {
  const answer = buildOfferFaq({
    ...FAQ_BASE,
    cooldown: null,
    eligibleFor: "Nowi klienci.\n- Osoby pełnoletnie;\n2) Bez konta w ostatnich 3 latach"
  })[3]?.answer;
  assert.match(
    answer ?? "",
    /Kto może skorzystać: Nowi klienci\. Osoby pełnoletnie\. Bez konta w ostatnich 3 latach\. Sprawdź to w regulaminie banku\.$/
  );
  // a question mark is kept, no ".?" and no ".."
  const odd = buildOfferFaq({ ...FAQ_BASE, cooldown: null, eligibleFor: "Czy masz 18 lat?\nTak.." })[3]?.answer ?? "";
  assert.match(odd, /Kto może skorzystać: Czy masz 18 lat\? Tak\. Sprawdź/);
});

test("FAQ: a 0 zł fee next to an 'Inne opłaty' remark is 'od 0 zł', never a bare 0 zł", () => {
  const remark = "Karta 6 zł/mies., chyba że płatności min. 300 zł.";
  const answer = nbsp(
    buildOfferFaq({
      ...FAQ_BASE,
      fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null, otherFee: remark }
    })[4]?.answer ?? ""
  );
  assert.match(
    answer,
    /^Opłata za konto: od 0 zł, zależnie od warunków opisanych w taryfie banku\. Opłata za kartę: od 0 zł, zależnie od warunków opisanych w taryfie banku\./
  );
  assert.doesNotMatch(answer, /Opłata za (konto|kartę): 0 zł/);
  // the remark itself is not copied into the answer (it is free text; the section shows it)
  assert.doesNotMatch(answer, /chyba że/);
  // without a remark the same fees are plainly free
  const plain = nbsp(
    buildOfferFaq({
      ...FAQ_BASE,
      fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null, otherFee: "   " }
    })[4]?.answer ?? ""
  );
  assert.match(plain, /^Opłata za konto: 0 zł\. Opłata za kartę: 0 zł\./);
});

/* ------------------------------------------------------------------ */
/* Structured data                                                     */
/* ------------------------------------------------------------------ */

function structured(overrides: Partial<Parameters<typeof buildOfferStructuredData>[0]["promotion"]> = {}) {
  const faq = buildOfferFaq(FAQ_BASE);
  return buildOfferStructuredData({
    promotion: {
      slug: "alior-konto-z-premia",
      name: "Alior Konto z Premią",
      bankName: "Alior Bank",
      bankWebsite: "https://www.aliorbank.pl/",
      bankLogoUrl: "https://img.example/alior.jpg",
      accountType: "PERSONAL",
      lastVerifiedAt: new Date("2026-10-07T08:00:00Z"),
      endDate: day("2026-10-31"),
      fees: { accountFeeCents: null, accountFeeWaiverCondition: null, cardFeeCents: null, cardFeeWaiverCondition: null },
      ...overrides
    },
    description: "Opis strony.",
    faq: faq.map((i) => ({ question: i.question, answer: i.answer }))
  }) as { "@context": string; "@graph": Record<string, unknown>[] };
}

test("structured data: ONE @graph with WebPage, BreadcrumbList, FinancialProduct and FAQPage", () => {
  const ld = structured();
  assert.equal(ld["@context"], "https://schema.org");
  const types = ld["@graph"].map((n) => n["@type"]);
  assert.deepEqual(types.sort(), ["BreadcrumbList", "FAQPage", "FinancialProduct", "WebPage"]);
  const faq = ld["@graph"].find((n) => n["@type"] === "FAQPage") as { mainEntity: unknown[]; "@context"?: string };
  assert.equal(faq.mainEntity.length, 6);
  assert.equal(faq["@context"], undefined); // the graph has the only @context
  const crumbs = ld["@graph"].find((n) => n["@type"] === "BreadcrumbList") as {
    itemListElement: { name: string; position: number }[];
  };
  assert.deepEqual(crumbs.itemListElement.map((c) => c.name), ["Start", "Promocje", "Alior Konto z Premią"]);
});

test("structured data: no rating, no review, no price, and an unverified fee is not written as 0", () => {
  const json = JSON.stringify(structured());
  assert.doesNotMatch(json, /AggregateRating|"Review"|ratingValue|"price"|priceCurrency/);
  assert.doesNotMatch(json, /feesAndCommissionsSpecification/);
});

test("structured data: a verified fee goes into the fee specification", () => {
  const ld = structured({
    fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 600, cardFeeWaiverCondition: "min. 300 zł płatności" }
  });
  const product = ld["@graph"].find((n) => n["@type"] === "FinancialProduct") as { feesAndCommissionsSpecification: string };
  assert.match(nbsp(product.feesAndCommissionsSpecification), /Opłata za prowadzenie konta: 0 zł/);
});

test("structured data: the fee specification and the visible FAQ word the same fees the same way", () => {
  const cases = [
    { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null, otherFee: "Karta 6 zł/mies. bez płatności." },
    { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 600, cardFeeWaiverCondition: "min. 300 zł płatności", otherFee: null },
    { accountFeeCents: 1200, accountFeeWaiverCondition: "wpływ 1000 zł", cardFeeCents: null, cardFeeWaiverCondition: null, otherFee: "Inne plany: zob. cennik." },
    { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null, otherFee: null }
  ];
  for (const fees of cases) {
    const faq = buildOfferFaq({ ...FAQ_BASE, fees });
    const answer = nbsp(faq[4]?.answer ?? "");
    const ld = structured({ fees });
    const product = ld["@graph"].find((n) => n["@type"] === "FinancialProduct") as { feesAndCommissionsSpecification?: string };
    const spec = product.feesAndCommissionsSpecification ?? "";
    // every fee the specification states is worded identically in the FAQ answer
    for (const label of ["Opłata za prowadzenie konta", "Opłata za kartę"]) {
      const sentence = new RegExp(String.raw`${label}: (.+?)\.(?: Opłata| Szczegółowe|$)`).exec(spec)?.[1];
      if (!sentence) continue;
      assert.ok(answer.includes(sentence), `${label}: "${sentence}" not in "${answer}"`);
    }
    // a bare "0 zł" appears in neither when a remark qualifies it
    if (fees.otherFee) {
      assert.doesNotMatch(spec, /: 0 zł\./);
      assert.doesNotMatch(answer, /: 0 zł\./);
    }
  }
});

test("structured data: a title with </script> cannot break out of the tag", () => {
  const ld = structured({ name: "Konto </script><script>alert(1)</script>" });
  const out = serializeJsonLd(ld);
  assert.doesNotMatch(out, /<\/script>/i);
  assert.doesNotMatch(out, /<script/i);
  assert.equal(
    (JSON.parse(out)["@graph"] as { "@type": string; name?: string }[]).find((n) => n["@type"] === "FinancialProduct")?.name,
    "Konto </script><script>alert(1)</script>"
  );
});
