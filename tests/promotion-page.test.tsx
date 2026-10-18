// WP-10: server-render tests of the offer page's components, plus source guards
// for the rules the page must keep (SEO library only, no partner commission or
// affiliate URL anywhere, no forbidden design patterns).
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BankOffers } from "../src/components/promocja/BankOffers";
import { BonusBreakdown, splitBonusParts } from "../src/components/promocja/BonusBreakdown";
import { EndCta } from "../src/components/promocja/EndCta";
import { FeesSection } from "../src/components/promocja/FeesSection";
import { ForWhom } from "../src/components/promocja/ForWhom";
import { KeyFacts } from "../src/components/promocja/KeyFacts";
import { MobileCtaBar } from "../src/components/promocja/MobileCtaBar";
import { OfferAside } from "../src/components/promocja/OfferAside";
import { OfferCta } from "../src/components/promocja/OfferCta";
import { OfferHeader } from "../src/components/promocja/OfferHeader";
import { OfferNotices } from "../src/components/promocja/OfferNotices";
import { SourceSection } from "../src/components/promocja/SourceSection";
import { ConditionsSection } from "../src/components/promocja/ConditionsSection";
import { RelatedGuide } from "../src/components/promocja/RelatedGuide";
import { deriveOfferState } from "../src/components/promocja/offerModel";
import { robotsForStatus } from "../src/lib/promotionAvailability";
import { absoluteUrl } from "../src/lib/seo";
import { buildSitemapEntries } from "../src/lib/seo/sitemapEntries";

const html = (el: ReactElement) => renderToStaticMarkup(el);
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/ /g, " ").trim();
const count = (haystack: string, re: RegExp) => (haystack.match(re) ?? []).length;

const NOW = new Date("2026-10-09T10:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const OPEN = deriveOfferState({ status: "ACTIVE", endDate: day("2026-10-31"), affiliateLinkEnabled: true }, NOW);
const ENDED = deriveOfferState({ status: "EXPIRED", endDate: day("2026-09-30"), affiliateLinkEnabled: true }, NOW);
const NOT_PROMOTED = deriveOfferState({ status: "ARCHIVED", endDate: day("2026-12-31"), affiliateLinkEnabled: true }, NOW);
const LINK_OFF = deriveOfferState({ status: "ACTIVE", endDate: day("2026-10-31"), affiliateLinkEnabled: false }, NOW);

/* ------------------------------------------------------------------ */
/* Call to action + disclosure                                         */
/* ------------------------------------------------------------------ */

const ctaProps = {
  href: "/out/alior-konto-z-premia?src=detail-cta",
  moreOffersHref: "/promocje",
  moreOffersLabel: "Zobacz inne promocje"
};

test("CTA (live): one tracked sponsored link, ONE arrow, and the compact disclosure right under it", () => {
  const out = html(h(OfferCta, { state: OPEN, id: "glowny-cta", ...ctaProps }));
  assert.equal(count(out, /href="\/out\//g), 1);
  assert.match(out, /id="glowny-cta"/);
  assert.match(out, /rel="sponsored nofollow noopener noreferrer"/);
  // The arrow belongs to the button (AffiliateCtaLink); the page adds none of its own.
  assert.equal(count(out, /lucide-arrow-right/g), 1);
  // The disclosure follows the link directly.
  const afterLink = out.slice(out.indexOf("</a>"));
  assert.doesNotMatch(afterLink, /data-disclosure/);
});

test("CTA (ended / not promoted): no /out/ link, a disabled button and a way to current offers", () => {
  for (const state of [ENDED, NOT_PROMOTED]) {
    const out = html(h(OfferCta, { state, ...ctaProps }));
    assert.doesNotMatch(out, /\/out\//);
    assert.match(out, /<button[^>]*disabled/);
    assert.doesNotMatch(out, /data-disclosure/);
    assert.match(out, /href="\/promocje"/);
  }
  assert.match(text(html(h(OfferCta, { state: ENDED, ...ctaProps }))), /Promocja zakończona/);
  assert.match(text(html(h(OfferCta, { state: NOT_PROMOTED, ...ctaProps }))), /Link niedostępny/);
});

test("CTA (partner link off): no bank button at all, only a sentence and the list link", () => {
  const out = html(h(OfferCta, { state: LINK_OFF, ...ctaProps }));
  assert.doesNotMatch(out, /\/out\//);
  assert.doesNotMatch(out, /<button/);
  assert.match(text(out), /Nie udostępniamy obecnie linku do tej oferty\./);
});

test("CTA (admin draft preview): the disclosure still follows the button directly; a note says /out/ is inactive", () => {
  const DRAFT = deriveOfferState({ status: "DRAFT", endDate: day("2026-10-31"), affiliateLinkEnabled: true }, NOW);
  assert.equal(DRAFT.ctaLive, true); // shown on purpose, so the preview looks like the final page
  const out = html(h(OfferCta, { state: DRAFT, id: "glowny-cta", ...ctaProps }));
  const afterLink = out.slice(out.indexOf("</a>"));
  assert.doesNotMatch(afterLink, /data-disclosure/);
  assert.match(text(out), /Podgląd: link \/out jest nieaktywny dla wersji roboczej\./);
  assert.ok(out.indexOf("data-draft-cta-note") > out.indexOf('data-disclosure="compact"'), "the note comes after the disclosure");
  // the closing block shows it too; a published offer never does
  const end = html(h(EndCta, { state: DRAFT, bankName: "Alior Bank", href: "/out/x?src=detail-cta-bottom", moreOffersHref: "/promocje", moreOffersLabel: "x" }));
  assert.match(text(end), /Podgląd: link \/out jest nieaktywny/);
  assert.doesNotMatch(html(h(OfferCta, { state: OPEN, ...ctaProps })), /data-draft-cta-note|Podgląd/);
  // a draft past its deadline has no button, hence no note either
  const lateDraft = deriveOfferState({ status: "DRAFT", endDate: day("2026-09-30"), affiliateLinkEnabled: true }, NOW);
  assert.doesNotMatch(html(h(OfferCta, { state: lateDraft, ...ctaProps })), /Podgląd:/);
});

test("end CTA: own tracking source, no disclosure and no 'not a bank' sentence", () => {
  const out = html(h(EndCta, { state: OPEN, bankName: "Alior Bank", href: "/out/x?src=detail-cta-bottom", moreOffersHref: "/promocje", moreOffersLabel: "x" }));
  assert.match(out, /href="\/out\/x\?src=detail-cta-bottom"/);
  assert.doesNotMatch(out, /data-disclosure/);
  assert.doesNotMatch(text(out), /Nie jesteśmy bankiem/);
  assert.match(text(out), /Przejdź bezpośrednio do wniosku na stronie Alior Bank/);

  const ended = html(h(EndCta, { state: ENDED, bankName: "Alior Bank", href: "/out/x", moreOffersHref: "/promocje", moreOffersLabel: "x" }));
  assert.doesNotMatch(ended, /\/out\//);
  assert.match(text(ended), /nie jest obecnie dostępna/);
});

test("sticky bar: rendered hidden and inert, with the compact disclosure under the button and its own source", () => {
  const out = html(
    h(MobileCtaBar, {
      href: "/out/x?src=detail-cta-sticky",
      amountText: "do 800 zł",
      termText: "Koniec za 4 dni",
      termTone: "warn",
      mainCtaId: "glowny-cta",
      endMarkerId: "komentarze"
    })
  );
  assert.match(out, /data-visible="false"/);
  assert.match(out, /\sinert(=""|\s|>)/);
  assert.match(out, /lg:hidden/);
  assert.match(out, /href="\/out\/x\?src=detail-cta-sticky"/);
  assert.match(out, /rel="sponsored nofollow noopener noreferrer"/);
  assert.equal(count(out, /data-disclosure="compact"/g), 0);
  assert.match(out, /pb-\[max\(0\.625rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(text(out), /do 800 zł Koniec za 4 dni Przejdź do promocji/);
});

/* ------------------------------------------------------------------ */
/* Aside                                                               */
/* ------------------------------------------------------------------ */

const asideProps = {
  state: OPEN,
  maxBonusCents: 80000,
  endDate: day("2026-10-13"),
  rating: 9.4,
  ctaHref: "/out/x?src=detail-cta",
  moreOffersHref: "/promocje",
  moreOffersLabel: "Zobacz inne promocje",
  ratingHref: "/metodologia",
  shareUrl: "https://bankmiplaci.pl/promocje/x",
  shareTitle: "X",
  checklist: h("div", { "data-card": "sciaga" }, "karta"),
  mainCtaId: "glowny-cta",
  now: NOW
};

test("aside: amount, deadline, CTA, share button, ściąga as its own tile and the rating with a comma", () => {
  const out = html(h(OfferAside, asideProps));
  const t = text(out);
  assert.match(t, /Premia do 800 zł/);
  assert.match(t, /Koniec za 4 dni \(do 13\.10\.2026\)/);
  assert.match(t, /Przejdź do promocji/);
  assert.match(t, /Poleć znajomemu/);
  assert.match(out, /<div id="sciaga"[^>]*><div data-card="sciaga">karta<\/div><\/div>/);
  assert.ok(out.indexOf('id="sciaga"') > out.indexOf("Poleć znajomemu"), "the ściąga tile is below the main one");
  assert.match(t, /Ocena serwisu 9,4\/10/);
  assert.doesNotMatch(t, /9\.4/);
  assert.match(out, /href="\/metodologia"[^>]*>Jak liczymy\?/);
  assert.equal(count(out, /data-disclosure="compact"/g), 0);
  assert.match(out, /lg:sticky/);
});

test("aside: no ściąga = no ściąga tile", () => {
  assert.doesNotMatch(html(h(OfferAside, { ...asideProps, checklist: null })), /id="sciaga"/);
});

test("aside: an offer without a cash premium never prints 0 zł as the premium", () => {
  const out = text(html(h(OfferAside, { ...asideProps, maxBonusCents: 0 })));
  assert.match(out, /Premia Bez premii gotówkowej/);
  assert.doesNotMatch(out, /Premia do/);
});

test("aside: an ended offer has no /out/ link", () => {
  const out = html(h(OfferAside, { ...asideProps, state: ENDED, endDate: day("2026-09-30"), checklist: null }));
  assert.doesNotMatch(out, /\/out\//);
  assert.doesNotMatch(out, /data-disclosure="compact"/);
  assert.match(text(out), /Zakończona 30\.09\.2026/);
});

/* ------------------------------------------------------------------ */
/* Summary bar                                                         */
/* ------------------------------------------------------------------ */

const factsProps = {
  maxBonusCents: 80000,
  endDate: day("2026-10-31"),
  difficulty: "EASY" as const,
  fees: { accountFeeCents: 0, accountFeeWaiverCondition: null },
  cooldown: { months: 36, cutoff: null },
  hasEligibilityText: true,
  now: NOW
};

test("summary bar: premium, deadline with days, difficulty, account fee, cooldown - the premium once", () => {
  const out = html(h(KeyFacts, factsProps));
  const t = text(out);
  assert.match(t, /W skrócie/);
  assert.match(t, /Premia do 800 zł/);
  assert.match(t, /Termin do 31\.10\.2026 zostały 22 dni/);
  assert.match(out, /aria-label="Trudność: łatwa, 2 z 4"/);
  assert.match(t, /Opłata za konto 0 zł/);
  assert.match(t, /Dla nowych klientów Karencja 36 mies\. od zamknięcia konta/);
  assert.equal(count(out, /800/g), 1);
  assert.match(out, /href="#dla-kogo"/);
});

test("summary bar: no premium, unknown fee, no cooldown rule - honest words, never 0 zł", () => {
  const out = text(
    html(
      h(KeyFacts, {
        ...factsProps,
        maxBonusCents: 0,
        fees: null,
        cooldown: null,
        hasEligibilityText: false
      })
    )
  );
  assert.match(out, /Premia Bez premii gotówkowej/);
  assert.match(out, /Opłata za konto Brak danych/);
  assert.match(out, /Dla kogo Brak danych/);
  assert.doesNotMatch(out, /Premia do/);
  assert.doesNotMatch(out, /(?<![\d.,])0 zł/);
});

test("summary bar: a conditional fee shows the rate and the waiver, no asterisk", () => {
  const out = text(html(h(KeyFacts, { ...factsProps, fees: { accountFeeCents: 1200, accountFeeWaiverCondition: "wpływ" } })));
  assert.match(out, /Opłata za konto 12 zł 0 zł po spełnieniu warunku/);
  assert.doesNotMatch(out, /\*/);
});

test("summary bar: an ended offer says so and keeps the colour out of the only signal", () => {
  const out = html(h(KeyFacts, { ...factsProps, endDate: day("2026-09-30") }));
  assert.match(text(out), /Zakończona 30\.09\.2026 Zapisy zamknięte/);
  assert.match(out, /text-coral-600/);
});

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

test("header: the H1 is the offer's name, the bank is an overline, no lead when there is no summary", () => {
  const out = html(
    h(OfferHeader, {
      name: "Alior Konto z Premią",
      summary: null,
      accountType: "PERSONAL",
      bank: { name: "Alior Bank", logoUrl: null },
      lastVerifiedAt: new Date("2026-10-07T08:00:00Z"),
      ended: false,
      draft: false,
      now: NOW
    })
  );
  assert.match(out, /<h1[^>]*>Alior Konto z Premią<\/h1>/);
  assert.equal(count(out, /<h1/g), 1);
  assert.match(text(out), /Alior Bank/);
  assert.match(text(out), /Konto osobiste/);
  assert.match(text(out), /Zweryfikowano 7 paź 2026/);
  assert.doesNotMatch(out, /type-lead|text-article/);
  assert.doesNotMatch(out, /Zakończona/);
});

test("header: the summary is the lead; a very long one is set as body text; ended and draft get badges", () => {
  const base = {
    name: "Oferta",
    accountType: "BUSINESS" as const,
    bank: { name: "Bank", logoUrl: null },
    lastVerifiedAt: null,
    now: NOW
  };
  const short = html(h(OfferHeader, { ...base, summary: "Krótki opis.", ended: true, draft: true }));
  assert.match(short, /type-lead/);
  assert.match(text(short), /Krótki opis\./);
  assert.match(text(short), /Brak daty weryfikacji/);
  assert.match(text(short), /Zakończona/);
  assert.match(text(short), /Roboczy/);
  const long = html(h(OfferHeader, { ...base, summary: "Dłuższy opis. ".repeat(40), ended: false, draft: false }));
  assert.doesNotMatch(long, /type-lead/);
  assert.match(long, /text-article/);
});

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

test("fees: unknown fees say 'Brak danych', a known waiver is one short line, no footnotes or other fees", () => {
  const out = html(
    h(FeesSection, {
      fees: {
        accountFeeCents: null,
        accountFeeWaiverCondition: "po 24 miesiącach: wpływ min. 1000 zł",
        cardFeeCents: null,
        cardFeeWaiverCondition: null,
        otherFee: "Dotyczy planu Standard.\nInne plany: sprawdź cennik.",
        sourceUrl: "https://bank.example/taryfa.pdf"
      }
    })
  );
  const t = text(out);
  assert.equal(count(t, /Brak danych/g), 2);
  assert.match(t, /0 zł gdy po 24 miesiącach: wpływ min\. 1000 zł/);
  assert.doesNotMatch(t, /nie zweryfikowaliśmy|Inne opłaty|Dotyczy planu Standard/);
  assert.doesNotMatch(out, /\*/);
});

test("fees: a missing Fees row is two 'Brak danych' rows, never 0 zł", () => {
  const t = text(html(h(FeesSection, { fees: null })));
  assert.match(t, /Opłata za konto Brak danych Opłata za kartę Brak danych/);
  assert.doesNotMatch(t, /(?<![\d.,])0 zł/);
  assert.doesNotMatch(t, /Inne opłaty/);
});

test("fees: confirmed 0 zł and a conditional rate are worded without a footnote", () => {
  const out = html(
    h(FeesSection, {
      fees: {
        accountFeeCents: 0,
        accountFeeWaiverCondition: null,
        cardFeeCents: 1000,
        cardFeeWaiverCondition: "min. 5 transakcji kartą",
        otherFee: null,
        sourceUrl: null
      }
    })
  );
  const t = text(out);
  assert.match(t, /Opłata za konto 0 zł/);
  assert.match(t, /Opłata za kartę 10 zł 0 zł gdy min\. 5 transakcji kartą/);
  assert.doesNotMatch(t, /Brak danych/);
  assert.doesNotMatch(out, /\*/);
  assert.match(out, /<caption class="sr-only">/);
  assert.match(out, /<th scope="row"/);
  assert.match(out, /break-words/);
});

test("for whom: free text as paragraph or list, empty fields leave no section", () => {
  const empty = html(h(ForWhom, { eligibleFor: null, notEligibleFor: "  ", cooldown: null, bankName: "B" }));
  assert.equal(empty, "");

  const both = html(
    h(ForWhom, {
      eligibleFor: "Nowi klienci.",
      notEligibleFor: "- Pracownicy banku\n- Osoby z kontem w ostatnich 3 latach",
      cooldown: { months: 36, cutoff: null },
      bankName: "Alior Bank"
    })
  );
  assert.match(both, /id="dla-kogo"/);
  assert.match(text(both), /Dla kogo jest promocja\? Kto może skorzystać Nowi klienci\./);
  assert.match(both, /<ul[^>]*><li[^>]*>Pracownicy banku<\/li><li[^>]*>Osoby z kontem w ostatnich 3 latach<\/li><\/ul>/);
  assert.match(text(both), /Kiedy możesz otworzyć konto\?/);
  assert.match(text(both), /nie miały konta w tym banku/);
  assert.match(both, /md:grid-cols-2/);
});

test("for whom: one list only, or only a cut-off date, still gives a section (without the karencja explainer)", () => {
  const one = html(h(ForWhom, { eligibleFor: "Pełnoletni.", notEligibleFor: null, cooldown: null, bankName: "B" }));
  assert.doesNotMatch(one, /md:grid-cols-2/);
  assert.doesNotMatch(text(one), /Kto nie może/);
  const cutoff = html(h(ForWhom, { eligibleFor: null, notEligibleFor: null, cooldown: { months: null, cutoff: day("2024-08-01") }, bankName: "Erste" }));
  assert.match(text(cutoff), /od 01\.08\.2024 nie miały konta w tym banku\./);
  assert.match(text(cutoff), /Szczegółowy zakres \(jakie produkty się liczą\) podaje regulamin promocji\./);
  assert.doesNotMatch(text(cutoff), /Erste|miałeś/);
  assert.doesNotMatch(text(cutoff), /Karencja to okres/);
});

test("bonus breakdown: details only for more than one open part; closed parts are listed apart and not summed", () => {
  const parts = [
    { id: "1", label: "Premia podstawowa", amountCents: 20000, availableUntil: null },
    { id: "2", label: "Premia za wpływ", amountCents: 30000, availableUntil: day("2026-12-01") },
    { id: "3", label: "Kantor", amountCents: 10000, availableUntil: day("2026-09-30") }
  ];
  const { open, closed } = splitBonusParts(parts, NOW);
  assert.deepEqual(open.map((p) => p.id), ["1", "2"]);
  assert.deepEqual(closed.map((p) => p.id), ["3"]);

  const out = html(h(BonusBreakdown, { openParts: open, closedParts: closed, maxBonusCents: 50000 }));
  const t = text(out);
  assert.match(out, /<details open=""/);
  assert.match(t, /Premia podstawowa 200 zł/);
  assert.match(t, /Premia maksymalna 500 zł/);
  assert.match(t, /Zakończone dla nowych uczestników/);
  assert.match(t, /Kantor \(zapisy do 30\.09\.2026\) 100 zł/);
  assert.match(t, /nie jest gwarantowana/);

  const single = html(h(BonusBreakdown, { openParts: open.slice(0, 1), closedParts: [], maxBonusCents: 20000 }));
  assert.equal(single, "");
  const onlyClosed = html(h(BonusBreakdown, { openParts: [], closedParts: closed, maxBonusCents: 0 }));
  assert.doesNotMatch(onlyClosed, /<details/);
  assert.match(text(onlyClosed), /Zakończone dla nowych uczestników/);
});

test("bonus breakdown: a label stored with its own amount does not print the amount twice", () => {
  const parts = [
    { id: "1", label: "Nagroda za 1. miesiąc po złożeniu wniosku — 200 zł", amountCents: 20000, availableUntil: null },
    { id: "2", label: "Nagroda za 2. miesiąc (200 zł)", amountCents: 20000, availableUntil: null },
    { id: "3", label: "Nagroda III stopnia (4× 100 zł)", amountCents: 40000, availableUntil: null },
    { id: "4", label: "Kantor — 100 zł", amountCents: 10000, availableUntil: day("2026-09-30") }
  ];
  const { open, closed } = splitBonusParts(parts, NOW);
  const t = text(html(h(BonusBreakdown, { openParts: open, closedParts: closed, maxBonusCents: 80000 })));
  assert.match(t, /Nagroda za 1\. miesiąc po złożeniu wniosku 200 zł Nagroda za 2\. miesiąc 200 zł Nagroda III stopnia \(4× 100 zł\) 400 zł Premia maksymalna 800 zł/);
  assert.doesNotMatch(t, /200 zł\s+200 zł|— 200 zł|\(200 zł\)/);
  // the ended part: label without its amount, then the sign-up date, then the amount once
  assert.match(t, /Kantor \(zapisy do 30\.09\.2026\) 100 zł/);
  assert.doesNotMatch(t, /Kantor — 100 zł/);
});

test("conditions: numbered static list, no ściąga link or card (the ściąga lives in the aside)", () => {
  const conditions = [
    { id: "a", title: "Otwórz konto", description: "Online." },
    { id: "b", title: "Płać kartą", description: null }
  ];
  const withSheet = html(h(ConditionsSection, { bankName: "Alior Bank", conditions }));
  assert.match(text(withSheet), /Warunki promocji Alior Bank krok po kroku/);
  assert.match(withSheet, /<ol/);
  assert.doesNotMatch(withSheet, /sciaga|Prowadź mnie/);
  assert.doesNotMatch(withSheet, /type="checkbox"/);

  const none = html(h(ConditionsSection, { bankName: "B", conditions: [] }));
  assert.match(text(none), /Nie mamy jeszcze rozpisanych kroków tej promocji/);
  assert.doesNotMatch(none, /href="#sciaga"/);
  // the numbered list is introduced as "steps plus rules": not every entry is an action
  assert.match(text(withSheet), /Lista może zawierać także dodatkowe zasady i ograniczenia/);
  assert.ok(withSheet.indexOf("Obok kroków") < withSheet.indexOf("<ol"));
  assert.doesNotMatch(none, /Obok kroków/);
});

/* ------------------------------------------------------------------ */
/* Source and verification                                             */
/* ------------------------------------------------------------------ */

const sourceProps = {
  slug: "alior-konto-z-premia",
  lastVerifiedAt: new Date("2026-10-07T08:00:00Z"),
  promoHref: "/out/alior-konto-z-premia?src=detail-source",
  sourceUrl: "https://www.aliorbank.pl/regulamin.pdf",
  additionalSourceUrls: ["https://www.aliorbank.pl/toip-konta-osobiste.pdf", "javascript:alert(1)"],
  feesSourceUrl: "https://www.aliorbank.pl/tabela.pdf",
  bankWebsite: "https://www.aliorbank.pl/",
  rating: 9.4,
  ratingReason: "Wysoka wartość i niski próg.",
  ratingHref: "/metodologia",
  verificationHref: "/metodologia#weryfikacja",
  now: NOW
};

test("source: verification, deadline, links to the bank's documents, rating with its note, report-error link", () => {
  const out = html(h(SourceSection, sourceProps));
  const t = text(out);
  assert.match(out, /id="zrodlo"/);
  assert.match(t, /Zweryfikowano 7 paź 2026/);
  assert.match(out, /href="\/metodologia#weryfikacja"/);
  assert.match(t, /Regulamin promocji/);
  assert.match(out, /href="https:\/\/www\.aliorbank\.pl\/regulamin\.pdf"[^>]*target="_blank"[^>]*rel="noopener noreferrer nofollow"/);
  assert.match(t, /Taryfa opłat i prowizji/);
  assert.match(t, /Strona promocyjna banku/);
  assert.match(out, /href="\/out\/alior-konto-z-premia\?src=detail-source"[^>]*rel="sponsored nofollow noopener noreferrer"/);
  assert.match(t, /9,4\/10 – Jak liczymy\? Wysoka wartość i niski próg\. Ocena serwisu, nie porada finansowa\./);
  assert.match(out, /href="\/kontakt\?oferta=alior-konto-z-premia"/);
  assert.match(t, /Zgłoś błąd w tej ofercie/);
  // a javascript: link typed into the admin never becomes an href
  assert.doesNotMatch(out, /javascript:/);
  // the bank's documents are plain links; only "Strona promocyjna banku" is the partner redirect
  assert.equal(count(out, /\/out\//g), 1);
});

test("source: no regulation link in the data is said plainly, the rating note is there without a reason", () => {
  const out = text(
    html(h(SourceSection, { ...sourceProps, sourceUrl: null, additionalSourceUrls: [], feesSourceUrl: null, ratingReason: null, promoHref: null, lastVerifiedAt: null }))
  );
  assert.match(out, /Regulamin promocji: brak linku w naszych danych/);
  assert.match(out, /Brak daty weryfikacji/);
  assert.doesNotMatch(out, /Strona promocyjna banku/);
  assert.match(out, /Ocena serwisu, nie porada finansowa\./);
});

/* ------------------------------------------------------------------ */
/* Notices, guide, bank offers                                         */
/* ------------------------------------------------------------------ */

test("notices: each state has its own wording and an ended offer links to the bank's current offers", () => {
  const props = { endDateText: "30.09.2026", bankName: "Erste", currentOffersHref: "#inne-promocje", regulationUrl: null };
  const ended = text(html(h(OfferNotices, { ...props, state: ENDED })));
  assert.match(ended, /Ta promocja zakończyła się 30\.09\.2026/);
  assert.match(ended, /Zobacz aktualne promocje Erste/);

  const notPromoted = text(html(h(OfferNotices, { ...props, state: NOT_PROMOTED })));
  assert.match(notPromoted, /Nie udostępniamy już linku do tej oferty/);
  assert.match(notPromoted, /Termin zapisów podany w regulaminie banku to 30\.09\.2026/);

  const off = html(h(OfferNotices, { ...props, state: LINK_OFF, regulationUrl: "https://bank.example/r.pdf" }));
  assert.match(text(off), /Nie udostępniamy teraz linku do tej oferty/);
  assert.match(off, /href="https:\/\/bank\.example\/r\.pdf"/);

  const draft = text(
    html(h(OfferNotices, { ...props, state: deriveOfferState({ status: "DRAFT", endDate: day("2026-10-31"), affiliateLinkEnabled: true }, NOW) }))
  );
  assert.match(draft, /Podgląd administratora/);
  assert.match(draft, /nie jest widoczna publicznie ani indeksowana/);

  assert.equal(html(h(OfferNotices, { ...props, state: OPEN })), "");
});

test("related guide: nothing without an article, a link to /blog/{slug} with one", () => {
  assert.equal(html(h(RelatedGuide, { article: null })), "");
  const out = html(h(RelatedGuide, { article: { slug: "jak-zdobyc-800-zl", excerpt: "Krok po kroku." } }));
  assert.match(out, /href="\/blog\/jak-zdobyc-800-zl"/);
  assert.match(text(out), /Dowiedz się więcej o tej promocji/);
});

test("bank offers: the disclosure strip sits above the list; an ended offer with no others says so", () => {
  const card = {
    slug: "inna",
    name: "Inna promocja",
    summary: null,
    maxBonusCents: 50000,
    difficulty: "EASY" as const,
    accountType: "PERSONAL" as const,
    rating: 9.1,
    ratingReason: null,
    endDate: day("2026-12-31"),
    lastVerifiedAt: new Date("2026-10-07T08:00:00Z"),
    fees: null,
    conditions: [{ title: "Otwórz konto" }],
    bank: { name: "Alior Bank", slug: "alior", logoUrl: null }
  };
  const out = html(h(BankOffers, { bankName: "Alior Bank", offers: [card], ended: false, allOffersHref: "/promocje?bank=alior" }));
  assert.match(text(out), /Inne promocje Alior Bank/);
  assert.ok(out.indexOf('data-disclosure="strip"') < out.indexOf('data-card="promotion"'));
  assert.match(out, /href="\/promocje\/inna"/);
  assert.doesNotMatch(out, /\/out\//);
  assert.match(out, /href="\/promocje\?bank=alior"/);

  assert.equal(html(h(BankOffers, { bankName: "A", offers: [], ended: false, allOffersHref: "/x" })), "");
  const none = html(h(BankOffers, { bankName: "Erste", offers: [], ended: true, allOffersHref: "/x" }));
  assert.match(text(none), /Aktualne promocje Erste Erste nie ma teraz aktualnych promocji w naszym zestawieniu\./);
  assert.match(none, /id="inne-promocje"/);
});

/* ------------------------------------------------------------------ */
/* Indexing                                                            */
/* ------------------------------------------------------------------ */

test("indexing: the page's <meta robots> and sitemap.xml agree for every kind of offer", () => {
  const cases: [string, string][] = [
    ["ACTIVE", "2026-10-31"], // open
    ["ACTIVE", "2026-10-09"], // last day
    ["ACTIVE", "2026-09-30"], // ended 9 days ago, cron has not run yet
    ["EXPIRED", "2026-09-30"], // ended <= 90 days: indexed, with the banner
    ["EXPIRED", "2026-07-01"], // ended 100 days ago: noindex
    ["EXPIRED", "2026-12-31"], // closed early, date ahead
    ["DRAFT", "2026-10-31"],
    ["ARCHIVED", "2026-10-31"]
  ];
  const promotions = cases.map(([status, end], i) => ({
    slug: `oferta-${i}`,
    status,
    endDate: day(end),
    accountType: "PERSONAL",
    contentUpdatedAt: null,
    lastVerifiedAt: new Date("2026-10-07T00:00:00Z")
  }));
  const listed = new Set(buildSitemapEntries({ promotions, articles: [], banks: [] }, NOW).map((e) => e.url));
  for (const p of promotions) {
    assert.equal(
      listed.has(absoluteUrl(`/promocje/${p.slug}`)),
      robotsForStatus(p.status, p.endDate, NOW).index,
      `${p.status} ${p.endDate.toISOString().slice(0, 10)}`
    );
  }
  // and the two ends of the policy really differ
  assert.equal(robotsForStatus("EXPIRED", day("2026-09-30"), NOW).index, true);
  assert.equal(robotsForStatus("EXPIRED", day("2026-07-01"), NOW).index, false);
});

/* ------------------------------------------------------------------ */
/* Source guards                                                       */
/* ------------------------------------------------------------------ */

const ROOT = join(__dirname, "..");
const PAGE_DIR = join(ROOT, "src/app/promocje/[slug]");
const OWN_DIRS = [PAGE_DIR, join(ROOT, "src/components/promocja")];
const OWN_FILES = [join(ROOT, "src/components/ShareButton.tsx")];

function ownSources(): { file: string; code: string }[] {
  const files = [...OWN_FILES];
  for (const dir of OWN_DIRS) {
    for (const name of readdirSync(dir)) if (/\.(tsx?|css)$/.test(name)) files.push(join(dir, name));
  }
  return files.map((file) => ({
    file,
    // Comments may talk about forbidden things ("no commission"); only code counts.
    code: readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
  }));
}

test("guards: the page reads the site URL, JSON-LD and metadata only through the SEO library", () => {
  for (const { file, code } of ownSources()) {
    assert.doesNotMatch(code, /dangerouslySetInnerHTML/, file);
    assert.doesNotMatch(code, /NEXT_PUBLIC_SITE_URL/, file);
    assert.doesNotMatch(code, /JSON\.stringify/, file);
  }
  const page = readFileSync(join(PAGE_DIR, "page.tsx"), "utf8");
  assert.match(page, /<JsonLd data=/);
  assert.match(page, /robotsForStatus\(promotion\.status, promotion\.endDate, now\)/);
  assert.match(page, /buildMetadata\(/);
  assert.match(page, /promotionTitle\(/);
  assert.match(page, /expiredPromotionTitle\(/);
  assert.match(page, /makeDescription\(/);
});

test("guards: the partner commission and the affiliate URL never appear in the page's code", () => {
  for (const { file, code } of ownSources()) {
    assert.doesNotMatch(code, /affiliateCommission|commissionCents|[^A-Za-z]affiliateUrl/, file);
  }
});

test("guards: the page keeps its caches and parallel reads", () => {
  const data = readFileSync(join(PAGE_DIR, "offerData.ts"), "utf8");
  assert.match(data, /export const getOffer = cache\(/);
  assert.match(data, /export const getViewer = cache\(/);
  const page = readFileSync(join(PAGE_DIR, "page.tsx"), "utf8");
  assert.match(page, /await Promise\.all\(\[\s*currentUser \?/);
  // The route is dynamic (the layout reads the session cookie): an ISR-style export on it turned edge cases
  // into HTTP 500 in production (commit 3add155), so neither export may come back before WP-17.
  assert.doesNotMatch(page, /export const revalidate\b/);
  assert.doesNotMatch(page, /export (async )?function generateStaticParams/);
});

test("guards: no forbidden design patterns in the page's code (spec sections 2 and 7)", () => {
  const forbidden: [string, RegExp][] = [
    ["text-ink-300 as text", /text-ink-300/],
    ["border-ink-100", /border-ink-100/],
    ["bg-ink-solid", /ink-solid/],
    ["white text on a teal fill", /bg-teal-[67]00?[^"]*text-white|text-white[^"]*bg-teal-[67]00?/],
    ["bg-teal-600 CTA", /bg-teal-600/],
    ["text-white", /\btext-white\b/],
    ["shadow-cardHover", /shadow-cardHover/],
    ["text-[10px]/[11px]", /text-\[1[01]px\]/],
    ["h-13", /\bh-13\b/],
    ["ink-200", /ink-200/],
    ["break-all", /break-all/],
    ["toFixed(1) on a rating", /toFixed\(1\)/],
    ["animate-ping", /animate-ping/],
    ["own arrow on a CTA", /ArrowRight[^;]*\n?[^;]*AffiliateCtaLink|AffiliateCtaLink[\s\S]{0,400}ArrowRight/]
  ];
  for (const { file, code } of ownSources()) {
    if (/\.test\./.test(file)) continue;
    for (const [name, re] of forbidden) {
      // RelatedGuide's "Przeczytaj poradnik" arrow is a plain link, not a CTA to a bank.
      if (name === "own arrow on a CTA" && /RelatedGuide/.test(file)) continue;
      assert.doesNotMatch(code, re, `${name} in ${file}`);
    }
  }
});
