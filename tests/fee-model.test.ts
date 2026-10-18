// The single fee model (src/lib/feeModel.ts) and the places that word a fee with it:
// the offer page (fees table, summary bar, FAQ), the JSON-LD, the offer card and
// the comparison. One input must never be read two ways.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FEE_WAIVER_NOTE, hasFeeCaveat, resolveFee } from "../src/lib/feeModel";
import { feesSpecificationText } from "../src/lib/seo/jsonld";
import { describeAccountFee } from "../src/components/promocje/cardCopy";
import { bestFlags, describeFee as describeCompareFee, feeRank } from "../src/app/porownaj/compareModel";
import { FeesSection } from "../src/components/promocja/FeesSection";
import { KeyFacts } from "../src/components/promocja/KeyFacts";
import { buildOfferFaq } from "../src/components/promocja/offerFaq";

const NBSP = " ";
const nbsp = (s: string) => s.replace(/ | /g, " ");
const html = (el: ReactElement) => renderToStaticMarkup(el);
const text = (markup: string) => nbsp(markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();

/* ------------------------------------------------------------------ */
/* The model                                                           */
/* ------------------------------------------------------------------ */

test("unknown: null, undefined, negative and non-finite are 'Brak danych' - never 0 zł", () => {
  for (const cents of [null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const fee = resolveFee(cents, null, "Inne opłaty: coś");
    assert.equal(fee.kind, "unknown");
    assert.equal(fee.cents, null);
    assert.equal(fee.label, "Brak danych");
    assert.equal(fee.hasCaveat, false, "there is no number to qualify");
    assert.equal(fee.waiverNote, null);
    assert.equal(fee.sentence, "brak danych – sprawdź tabelę opłat banku");
    assert.doesNotMatch(nbsp(`${fee.label} ${fee.sentence}`), /0 zł/);
  }
});

test("free: 0 zł with no condition (blank text is no condition)", () => {
  for (const waiver of [null, undefined, "", "   "]) {
    const fee = resolveFee(0, waiver);
    assert.equal(fee.kind, "free");
    assert.equal(fee.cents, 0);
    assert.equal(fee.label, `0${NBSP}zł`);
    assert.equal(fee.sentence, `0${NBSP}zł`);
    assert.equal(fee.hasCaveat, false);
    assert.equal(fee.waiver, null);
  }
});

test("0 zł WITH a waiver condition is contradictory = unknown, and the condition is kept to be said", () => {
  const fee = resolveFee(0, "  wpływ min.   1000 zł ", "Inne opłaty");
  assert.equal(fee.kind, "unknown");
  assert.equal(fee.cents, null);
  assert.equal(fee.waiver, "wpływ min. 1000 zł");
  assert.equal(fee.label, "Brak danych");
  assert.equal(fee.hasCaveat, false);
});

test("a 0 zł fee next to a caveat (Fees.otherFee) is 'od 0 zł' - the number is the best case", () => {
  for (const caveat of ["Karta 6 zł/mies., chyba że płatności min. 300 zł", true]) {
    const fee = resolveFee(0, null, caveat);
    assert.equal(fee.kind, "free");
    assert.equal(fee.hasCaveat, true);
    assert.equal(fee.label, `od${NBSP}0${NBSP}zł`);
    assert.equal(nbsp(fee.sentence), "od 0 zł, zależnie od warunków opisanych w taryfie banku");
  }
  // blank / false / absent caveats change nothing
  for (const caveat of ["", "  \n ", false, null, undefined]) {
    const fee = resolveFee(0, null, caveat);
    assert.equal(fee.hasCaveat, false);
    assert.equal(fee.label, `0${NBSP}zł`);
  }
  assert.equal(hasFeeCaveat("x"), true);
  assert.equal(hasFeeCaveat(" "), false);
  assert.equal(hasFeeCaveat(true), true);
  assert.equal(hasFeeCaveat(undefined), false);
});

test("paid and conditional keep their amount; the caveat is a flag only", () => {
  const paid = resolveFee(1200, null);
  assert.deepEqual([paid.kind, paid.cents, paid.waiverNote], ["paid", 1200, null]);
  assert.equal(nbsp(paid.label), "12 zł");
  assert.equal(nbsp(paid.sentence), "12 zł");
  assert.equal(paid.hasCaveat, false);

  const paidCaveat = resolveFee(1200, null, "Inne plany: zob. cennik");
  assert.equal(nbsp(paidCaveat.label), "12 zł");
  assert.equal(paidCaveat.hasCaveat, true);

  const cents = resolveFee(4950, null);
  assert.equal(nbsp(cents.label), "49,50 zł");

  const cond = resolveFee(600, "  płatności  kartą min. 300 zł. ", "Inne opłaty");
  assert.equal(cond.kind, "conditional");
  assert.equal(cond.waiver, "płatności kartą min. 300 zł.");
  assert.equal(cond.waiverNote, FEE_WAIVER_NOTE);
  assert.equal(nbsp(cond.waiverNote ?? ""), "0 zł po spełnieniu warunku");
  assert.equal(nbsp(cond.sentence), "6 zł (0 zł po spełnieniu warunku: płatności kartą min. 300 zł)");
  assert.equal(cond.hasCaveat, true);
});

test("a very long condition is shortened in the sentence on a word boundary, never in the data", () => {
  const long = "wpływ min. 3000 zł z innego banku i płatności kartą lub BLIKIEM w miesiącu ".repeat(6).trim();
  const fee = resolveFee(1200, long);
  assert.equal(fee.waiver, long);
  assert.ok(fee.sentence.length < long.length);
  assert.match(fee.sentence, /…\)$/);
});

test("the label is a bare '0 zł' only for a confirmed fee with no condition AND no caveat", () => {
  const bare = `0${NBSP}zł`;
  for (const cents of [null, 0, 600]) {
    for (const waiver of [null, "warunek"]) {
      for (const caveat of [undefined, false, true, "uwaga"]) {
        const fee = resolveFee(cents, waiver, caveat);
        const confirmedPlainFree = cents === 0 && !waiver && !caveat;
        assert.equal(fee.label === bare, confirmedPlainFree, JSON.stringify({ cents, waiver, caveat, label: fee.label }));
        assert.equal(fee.sentence === bare, confirmedPlainFree);
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* One input, every surface                                            */
/* ------------------------------------------------------------------ */

const FAQ_BASE = {
  name: "Konto",
  bankName: "Bank",
  maxBonusCents: 0,
  bonusParts: [],
  conditions: [],
  endDate: new Date("2026-12-31T00:00:00Z"),
  ended: false,
  cooldown: null,
  eligibleFor: null,
  lastVerifiedAt: null,
  verificationHref: "/metodologia#weryfikacja"
};
const NOW = new Date("2026-10-09T10:00:00Z");

const REMARK = "Karta 6 zł/mies., chyba że płatności min. 300 zł.";
const SCENARIOS = [
  { name: "free, no remark", cents: 0, waiver: null, other: null },
  { name: "free + remark (Alior)", cents: 0, waiver: null, other: REMARK },
  { name: "paid", cents: 1200, waiver: null, other: null },
  { name: "paid + remark", cents: 1200, waiver: null, other: REMARK },
  { name: "conditional", cents: 600, waiver: "min. 300 zł płatności", other: null },
  { name: "conditional + remark", cents: 600, waiver: "min. 300 zł płatności", other: REMARK },
  { name: "contradictory 0 + condition", cents: 0, waiver: "wpływ 1000 zł", other: REMARK },
  { name: "not verified", cents: null, waiver: null, other: REMARK }
] as const;

test("every surface reads the same input the same way", () => {
  for (const sc of SCENARIOS) {
    const fee = resolveFee(sc.cents, sc.waiver, sc.other);
    const fees = {
      accountFeeCents: sc.cents,
      accountFeeWaiverCondition: sc.waiver,
      cardFeeCents: sc.cents,
      cardFeeWaiverCondition: sc.waiver,
      otherFee: sc.other
    };

    // offer card (list): the same kind and label
    const card = describeAccountFee({
      accountFeeCents: sc.cents,
      accountFeeWaiverCondition: sc.waiver,
      hasOtherFee: Boolean(sc.other)
    });
    assert.equal(card.kind, fee.kind, sc.name);
    assert.equal(card.text, fee.label, sc.name);
    assert.equal(card.note, fee.waiverNote ?? undefined, sc.name);

    // comparison: the same kind, the same amount, the same caveat
    const view = describeCompareFee(sc.cents, sc.waiver, Boolean(sc.other));
    assert.equal(view.kind, fee.kind, sc.name);
    if (view.kind === "paid" || view.kind === "conditional") assert.equal(view.cents, fee.cents, sc.name);
    if (view.kind === "free") assert.equal(Boolean(view.hasCaveat), fee.hasCaveat, sc.name);

    // JSON-LD: says the same words, or nothing when the fee is unknown
    const spec = feesSpecificationText({ ...fees, atmFeeCents: null });
    if (fee.kind === "unknown") {
      assert.equal(spec, null, sc.name);
    } else {
      assert.ok(spec?.includes(nbsp(fee.sentence)), `${sc.name}: ${spec} / ${fee.sentence}`);
    }

    // FAQ: the same sentence for both fees
    const answer = nbsp(buildOfferFaq({ ...FAQ_BASE, fees })[4]?.answer ?? "");
    assert.ok(answer.includes(`Opłata za konto: ${nbsp(fee.sentence)}.`), `${sc.name}: ${answer}`);
    assert.ok(answer.includes(`Opłata za kartę: ${nbsp(fee.sentence)}.`), `${sc.name}: ${answer}`);

    // fees table and summary bar: the label (a bare 0 zł only when nothing qualifies it)
    const table = text(html(h(FeesSection, { fees: { ...fees, sourceUrl: null } })));
    assert.ok(table.includes(`Opłata za konto ${nbsp(fee.label)}`), `${sc.name}: ${table}`);
    assert.ok(table.includes(`Opłata za kartę ${nbsp(fee.label)}`), `${sc.name}: ${table}`);
    const facts = text(
      html(
        h(KeyFacts, {
          maxBonusCents: 0,
          endDate: new Date("2026-12-31T00:00:00Z"),
          difficulty: "EASY",
          fees,
          cooldown: null,
          hasEligibilityText: false,
          now: NOW
        })
      )
    );
    assert.ok(facts.includes(`Opłata za konto ${nbsp(fee.label)}`), `${sc.name}: ${facts}`);
  }
});

test("page: 'od 0 zł' in the table, a way to the conditions, no footnote and no other fees", () => {
  const fees = {
    accountFeeCents: 0,
    accountFeeWaiverCondition: null,
    cardFeeCents: 0,
    cardFeeWaiverCondition: null,
    otherFee: REMARK,
    sourceUrl: null
  };
  const table = html(h(FeesSection, { fees }));
  assert.match(table, /<section id="oplaty"/);
  assert.doesNotMatch(text(table), /najlepszym przypadku|Inne opłaty/);
  assert.doesNotMatch(text(table), /Opłata za (konto|kartę) 0 zł/);

  const facts = html(
    h(KeyFacts, {
      maxBonusCents: 0,
      endDate: new Date("2026-12-31T00:00:00Z"),
      difficulty: "EASY",
      fees,
      cooldown: null,
      hasEligibilityText: false,
      now: NOW
    })
  );
  assert.match(text(facts), /Opłata za konto od 0 zł Sprawdź warunki opłat/);
  assert.match(facts, /href="#oplaty"/);

  // a plain 0 zł fee (no remark) needs neither
  const plain = html(h(FeesSection, { fees: { ...fees, otherFee: null } }));
  assert.doesNotMatch(text(plain), /Od 0 zł/);
  assert.match(text(plain), /Opłata za konto 0 zł Opłata za kartę 0 zł/);
});

/* ------------------------------------------------------------------ */
/* Comparison and card details                                         */
/* ------------------------------------------------------------------ */

test("comparison: a 0 zł fee with a remark never wins 'best in the row' over a plain 0 zł", () => {
  assert.deepEqual(describeCompareFee(0, null), { kind: "free" }); // shape unchanged for existing callers
  assert.deepEqual(describeCompareFee(0, null, false), { kind: "free" });
  assert.deepEqual(describeCompareFee(0, null, true), { kind: "free", hasCaveat: true });
  assert.equal(feeRank(describeCompareFee(0, null, true)), 1);
  assert.equal(feeRank(describeCompareFee(0, null)), 0);

  const ranks = [describeCompareFee(0, null), describeCompareFee(0, null, true), describeCompareFee(600)].map(feeRank);
  assert.deepEqual(bestFlags(ranks, "min"), [true, false, false]);
  // two qualified zeros and a paid fee: nothing is promised as "best"
  const qualified = [describeCompareFee(0, null, true), describeCompareFee(0, null, true), describeCompareFee(600)].map(feeRank);
  assert.deepEqual(bestFlags(qualified, "min"), [false, false, false]);
});

test("card: the account fee line says 'od 0 zł' when the offer carries a remark, and is unchanged without the flag", () => {
  assert.deepEqual(describeAccountFee({ accountFeeCents: 0 }), { kind: "free", text: `0${NBSP}zł` });
  assert.deepEqual(describeAccountFee({ accountFeeCents: 0, hasOtherFee: true }), { kind: "free", text: `od${NBSP}0${NBSP}zł` });
  assert.deepEqual(describeAccountFee({ accountFeeCents: null, hasOtherFee: true }), { kind: "unknown", text: "Brak danych" });
});

/* ------------------------------------------------------------------ */
/* Source guard: the rule lives in one place                           */
/* ------------------------------------------------------------------ */

const ROOT = join(__dirname, "..");
const CONSUMERS = [
  "src/lib/seo/jsonld.ts",
  "src/components/promocje/cardCopy.ts",
  "src/app/porownaj/compareModel.ts",
  "src/components/promocja/offerFaq.ts",
  "src/components/promocja/FeesSection.tsx",
  "src/components/promocja/KeyFacts.tsx"
];

test("guard: every place that words a fee goes through the shared model", () => {
  for (const file of CONSUMERS) {
    const code = readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.match(code, /@\/lib\/feeModel/, file);
    // the rule itself ("0 and a condition ...", "waived rate") is not re-implemented
    assert.doesNotMatch(code, /(?:Cents|cents)\s*===\s*0/, file);
    assert.doesNotMatch(code, /formatFeeCompact/, file);
  }
  const offerModel = readFileSync(join(ROOT, "src/components/promocja/offerModel.ts"), "utf8");
  assert.doesNotMatch(offerModel, /export function (describeFee|feeFaqText|feeValueText)/);
});
