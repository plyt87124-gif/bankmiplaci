import test from "node:test";
import assert from "node:assert/strict";
import {
  BONUS_DIVISOR_CENTS,
  CONDITION_TYPE_CARD,
  CONDITION_TYPE_INFLOW,
  EFFORT_FIT_POINTS,
  QUIZ_QUESTIONS,
  QUIZ_QUESTION_COUNT,
  QUIZ_RESULT_COUNT,
  QUIZ_NO_FULL_MATCH_NOTICE,
  QUIZ_RESULT_TITLE_CLOSEST,
  QUIZ_RESULT_TITLE_FULL,
  buildCompareHref,
  conditionFlagsFromTypes,
  explainMatch,
  isFullMatch,
  matchOffers,
  noFullMatch,
  parseAnswers,
  toQuizOffers,
  type QuizAnswers,
  type QuizOffer
} from "../src/lib/quiz";

function offer(slug: string, overrides: Partial<QuizOffer> = {}): QuizOffer {
  return {
    slug,
    name: `Oferta ${slug}`,
    bank: { name: `Bank ${slug}`, slug: `bank-${slug}`, logoUrl: null },
    accountType: "PERSONAL",
    difficulty: "EASY",
    maxBonusCents: 50_000,
    rating: 8,
    endDate: "2026-12-31T00:00:00.000Z",
    needsCardPayments: false,
    needsInflow: false,
    ...overrides
  };
}

const ANSWERS: QuizAnswers = {
  effort: "low",
  audience: "personal",
  canCardPay: true,
  canInflow: true,
  topBonus: false
};

const slugs = (answers: QuizAnswers, offers: QuizOffer[]) => matchOffers(offers, answers).map((m) => m.offer.slug);

/* ---------------- constants and questions ---------------- */

test("the counts shown in copy come from the question list and the result size", () => {
  assert.equal(QUIZ_QUESTION_COUNT, QUIZ_QUESTIONS.length);
  assert.equal(QUIZ_QUESTION_COUNT, 5);
  assert.equal(QUIZ_RESULT_COUNT, 3);
});

test("every answer in ANSWERS has exactly one question, with at least two options and unique ids", () => {
  const ids = QUIZ_QUESTIONS.map((q) => q.id).sort();
  assert.deepEqual(ids, Object.keys(ANSWERS).sort());
  for (const question of QUIZ_QUESTIONS) {
    assert.ok(question.options.length >= 2, question.id);
    assert.equal(new Set(question.options.map((o) => o.id)).size, question.options.length, question.id);
  }
});

test("questions and answers contain no emoji", () => {
  const all = QUIZ_QUESTIONS.flatMap((q) => [q.title, q.hint ?? "", ...q.options.map((o) => o.label)]).join(" ");
  assert.doesNotMatch(all, /\p{Extended_Pictographic}/u);
});

/* ---------------- parseAnswers ---------------- */

test("parseAnswers turns a complete draft into typed answers", () => {
  assert.deepEqual(
    parseAnswers({ effort: "medium", audience: "business", canCardPay: "no", canInflow: "yes", topBonus: "yes" }),
    { effort: "medium", audience: "business", canCardPay: false, canInflow: true, topBonus: true }
  );
});

test("parseAnswers returns null for an incomplete draft or an unknown option id", () => {
  assert.equal(parseAnswers({}), null);
  assert.equal(parseAnswers({ effort: "low", audience: "personal", canCardPay: "yes", canInflow: "yes" }), null);
  assert.equal(
    parseAnswers({ effort: "extreme", audience: "personal", canCardPay: "yes", canInflow: "yes", topBonus: "no" }),
    null
  );
});

/* ---------------- canCardPay / canInflow really change the result ---------------- */

test("canCardPay=no ranks an offer with a card-payment condition below one without, even with a better rating", () => {
  const withCard = offer("karta", { rating: 9.5, needsCardPayments: true });
  const without = offer("bez", { rating: 7 });
  assert.deepEqual(slugs({ ...ANSWERS, canCardPay: true }, [without, withCard]), ["karta", "bez"]);
  assert.deepEqual(slugs({ ...ANSWERS, canCardPay: false }, [without, withCard]), ["bez", "karta"]);
});

test("canInflow=no ranks an offer with an inflow condition below one without", () => {
  const withInflow = offer("wplyw", { rating: 9.5, needsInflow: true });
  const without = offer("bez", { rating: 7 });
  assert.deepEqual(slugs({ ...ANSWERS, canInflow: true }, [without, withInflow]), ["wplyw", "bez"]);
  assert.deepEqual(slugs({ ...ANSWERS, canInflow: false }, [without, withInflow]), ["bez", "wplyw"]);
});

test("an offer with both conditions unmet falls below one with a single unmet condition", () => {
  const both = offer("oba", { rating: 9.9, needsCardPayments: true, needsInflow: true });
  const one = offer("jeden", { rating: 6, needsCardPayments: true });
  const answers = { ...ANSWERS, canCardPay: false, canInflow: false };
  assert.deepEqual(slugs(answers, [both, one]), ["jeden", "oba"]);
  const match = matchOffers([both], answers)[0]!;
  assert.equal(match.unmet, 2);
  assert.equal(match.cautions.filter((c) => /płatności kartą|wpływu na konto/.test(c)).length, 2);
});

test("unmet conditions produce a caution, met ones a reason; neither is said when the offer has no such condition", () => {
  const card = offer("karta", { needsCardPayments: true });
  const no = matchOffers([card], { ...ANSWERS, canCardPay: false })[0]!;
  assert.ok(no.cautions.some((c) => c.includes("płatności kartą")));
  const yes = matchOffers([card], { ...ANSWERS, canCardPay: true })[0]!;
  assert.ok(yes.reasons.some((r) => r.includes("płatności kartą")));
  assert.ok(!yes.cautions.some((c) => c.includes("płatności kartą")));

  const plain = matchOffers([offer("zwykla")], { ...ANSWERS, canCardPay: false, canInflow: false })[0]!;
  assert.equal(plain.unmet, 0);
  assert.ok(!plain.cautions.some((c) => /płatności kartą|wpływu na konto/.test(c)));
});

/* ---------------- the other answers ---------------- */

test("audience filters to business accounts only, or to every non-business account", () => {
  const offers = [
    offer("osobiste", { accountType: "PERSONAL" }),
    offer("mlodzi", { accountType: "YOUNG" }),
    offer("oszczednosciowe", { accountType: "SAVINGS" }),
    offer("wspolne", { accountType: "JOINT" }),
    offer("firmowe", { accountType: "BUSINESS" })
  ];
  assert.deepEqual(slugs({ ...ANSWERS, audience: "business" }, offers), ["firmowe"]);
  const personal = matchOffers(offers, { ...ANSWERS, audience: "personal" }, 10).map((m) => m.offer.slug).sort();
  assert.deepEqual(personal, ["mlodzi", "osobiste", "oszczednosciowe", "wspolne"]);
});

test("effort adds the fit points to offers of the matching difficulty (original mapping kept)", () => {
  const easy = offer("latwa", { difficulty: "EASY", rating: 8 });
  const hard = offer("trudna", { difficulty: "HARD", rating: 8 });
  const low = matchOffers([easy, hard], { ...ANSWERS, effort: "low" });
  assert.equal(low[0]!.offer.slug, "latwa");
  assert.equal(low[0]!.score, 8 + EFFORT_FIT_POINTS);
  assert.equal(low[1]!.score, 8);
  assert.ok(low[1]!.cautions.some((c) => c.includes("trudność: trudna")));

  const high = matchOffers([easy, hard], { ...ANSWERS, effort: "high" });
  assert.equal(high[0]!.offer.slug, "trudna");
  assert.equal(high[1]!.cautions.length, 0, "an easier offer than wanted is not a problem");
});

test("topBonus adds 1 point per 200 zł of the maximum bonus and can decide the order", () => {
  const rich = offer("duza", { maxBonusCents: 400_000, rating: 7, difficulty: "HARD" });
  const modest = offer("mala", { maxBonusCents: 50_000, rating: 9, difficulty: "HARD" });
  assert.deepEqual(slugs({ ...ANSWERS, effort: "high", topBonus: false }, [modest, rich]), ["mala", "duza"]);
  assert.deepEqual(slugs({ ...ANSWERS, effort: "high", topBonus: true }, [modest, rich]), ["duza", "mala"]);
  const scored = matchOffers([rich], { ...ANSWERS, effort: "high", topBonus: true })[0]!;
  assert.equal(scored.score, 7 + EFFORT_FIT_POINTS + 400_000 / BONUS_DIVISOR_CENTS);
});

test("an offer without a cash bonus gets no bonus points and no 'premia do' reason", () => {
  const none = matchOffers([offer("zero", { maxBonusCents: 0 })], { ...ANSWERS, topBonus: true })[0]!;
  assert.equal(none.score, 8 + EFFORT_FIT_POINTS);
  assert.ok(!none.reasons.some((r) => r.startsWith("premia do")));
});

test("each of the five answers can change the top result", () => {
  const offers = [
    offer("a", { difficulty: "EASY", rating: 8, maxBonusCents: 40_000, needsCardPayments: true }),
    offer("b", { difficulty: "HARD", rating: 8, maxBonusCents: 400_000 }),
    offer("c", { difficulty: "EASY", rating: 7, maxBonusCents: 40_000, needsInflow: true }),
    offer("d", { accountType: "BUSINESS", difficulty: "EASY", rating: 9, maxBonusCents: 100_000 })
  ];
  const top = (a: QuizAnswers) => matchOffers(offers, a, 1)[0]!.offer.slug;
  const base = top(ANSWERS);
  assert.notEqual(top({ ...ANSWERS, effort: "high" }), base, "effort");
  assert.notEqual(top({ ...ANSWERS, audience: "business" }), base, "audience");
  assert.notEqual(top({ ...ANSWERS, canCardPay: false }), base, "canCardPay");
  assert.notEqual(top({ ...ANSWERS, canInflow: false, canCardPay: false, effort: "high", topBonus: false }), "c", "canInflow");
  assert.notEqual(top({ ...ANSWERS, effort: "medium", topBonus: true }), base, "topBonus");
});

/* ---------------- result shape ---------------- */

test("returns at most 3 results, best first, and never mutates the input", () => {
  const offers = ["a", "b", "c", "d", "e"].map((s, i) => offer(s, { rating: 5 + i }));
  const copy = JSON.stringify(offers);
  const result = matchOffers(offers, ANSWERS);
  assert.equal(result.length, QUIZ_RESULT_COUNT);
  assert.deepEqual(result.map((m) => m.offer.slug), ["e", "d", "c"]);
  assert.equal(JSON.stringify(offers), copy);
  assert.deepEqual(matchOffers([], ANSWERS), []);
  assert.equal(matchOffers(offers, ANSWERS, 0).length, 0);
});

test("ties are broken by rating and then by slug, so the order is stable", () => {
  const offers = [offer("b"), offer("a"), offer("c")];
  assert.deepEqual(slugs(ANSWERS, offers), ["a", "b", "c"]);
  assert.deepEqual(slugs(ANSWERS, [...offers].reverse()), ["a", "b", "c"]);
});

test("explainMatch is one sentence of facts built from the reasons", () => {
  const match = matchOffers([offer("a", { rating: 8.9 })], ANSWERS)[0]!;
  assert.equal(explainMatch(match), "Dlaczego: trudność „łatwa” pasuje do Twojego nakładu pracy; ocena serwisu 8,9/10.");
  assert.equal(explainMatch({ reasons: [] }), "");
});

test("a non-finite rating counts as 0 instead of poisoning the sort", () => {
  const result = matchOffers([offer("nan", { rating: Number.NaN }), offer("ok", { rating: 5 })], ANSWERS);
  assert.deepEqual(result.map((m) => m.offer.slug), ["ok", "nan"]);
  assert.ok(result.every((m) => Number.isFinite(m.score)));
});

/* ---------------- data in ---------------- */

test("conditionFlagsFromTypes reads only the card and inflow types", () => {
  assert.deepEqual(conditionFlagsFromTypes([]), { needsCardPayments: false, needsInflow: false });
  assert.deepEqual(conditionFlagsFromTypes(["other", "deadline", "account_opening"]), {
    needsCardPayments: false,
    needsInflow: false
  });
  assert.deepEqual(conditionFlagsFromTypes([CONDITION_TYPE_CARD, "other"]), { needsCardPayments: true, needsInflow: false });
  assert.deepEqual(conditionFlagsFromTypes([CONDITION_TYPE_INFLOW, CONDITION_TYPE_CARD]), {
    needsCardPayments: true,
    needsInflow: true
  });
});

test("toQuizOffers copies only the whitelisted fields (no affiliate URL, no commission, no summary)", () => {
  const card = {
    slug: "x",
    name: "Konto X",
    summary: "tekst",
    bank: { name: "Bank", slug: "bank", logoUrl: "https://example.com/l.png" },
    accountType: "PERSONAL",
    difficulty: "EASY",
    maxBonusCents: 100,
    rating: 9.1,
    endDate: new Date("2026-12-31T00:00:00Z"),
    affiliateUrl: "https://partner.example/secret",
    affiliateCommissionCents: 12_345,
    fees: null
  };
  const [out] = toQuizOffers([card as never], new Map([["x", { needsCardPayments: true, needsInflow: false }]]));
  assert.deepEqual(Object.keys(out!).sort(), [
    "accountType",
    "bank",
    "difficulty",
    "endDate",
    "maxBonusCents",
    "name",
    "needsCardPayments",
    "needsInflow",
    "rating",
    "slug"
  ]);
  assert.equal(out!.endDate, "2026-12-31T00:00:00.000Z");
  assert.equal(out!.needsCardPayments, true);
  assert.equal(out!.needsInflow, false);
  const json = JSON.stringify(out);
  assert.doesNotMatch(json, /secret|12345|affiliate|commission/i);
  // An offer without any flagged condition is not flagged.
  assert.equal(toQuizOffers([card as never], new Map())[0]!.needsCardPayments, false);
});

/* ---------------- link to the comparison ---------------- */

test("buildCompareHref preselects the offers; business adds typ=BUSINESS, personal is the page default", () => {
  assert.equal(buildCompareHref(["a", "b", "c"], "personal"), "/porownaj?oferty=a,b,c");
  assert.equal(buildCompareHref(["a", "b"], "business"), "/porownaj?typ=BUSINESS&oferty=a,b");
  assert.equal(buildCompareHref([], "personal"), "/porownaj");
  assert.equal(buildCompareHref(["a b"], "personal"), "/porownaj?oferty=a%20b");
});

/* ---------------- no full match, wording of the questions ---------------- */

test("the effort question does not repeat the bonus question", () => {
  const effort = QUIZ_QUESTIONS.find((q) => q.id === "effort")!;
  const bonus = QUIZ_QUESTIONS.find((q) => q.id === "topBonus")!;
  assert.doesNotMatch(effort.options.map((o) => o.label).join(" "), /premi/i);
  assert.match(bonus.title, /premi/i);
});

test("an unmet condition cautions with the short 'Możesz nie dostać całej premii.'", () => {
  const cardOffer = offer("k", { needsCardPayments: true, needsInflow: true });
  const [match] = matchOffers([cardOffer], { ...ANSWERS, canCardPay: false, canInflow: false });
  assert.equal(match!.cautions.length, 2);
  for (const caution of match!.cautions) {
    assert.match(caution, /Możesz nie dostać całej premii\.$/);
    assert.doesNotMatch(caution, /poza zasięgiem/);
  }
});

test("noFullMatch is true only when every proposal has an unmet condition; isFullMatch only when none has", () => {
  const needs = (slug: string) => offer(slug, { needsCardPayments: true });
  const answers = { ...ANSWERS, canCardPay: false };
  const allUnmet = matchOffers([needs("a"), needs("b")], answers);
  assert.equal(noFullMatch(allUnmet), true);
  assert.equal(isFullMatch(allUnmet), false);

  const mixed = matchOffers([needs("a"), offer("b")], answers);
  assert.equal(noFullMatch(mixed), false);
  assert.equal(isFullMatch(mixed), false);

  const clean = matchOffers([offer("a"), offer("b")], answers);
  assert.equal(noFullMatch(clean), false);
  assert.equal(isFullMatch(clean), true);

  assert.equal(noFullMatch([]), false);
  assert.equal(isFullMatch([]), false);
});

test("result copy for the 'nothing fits everything' case", () => {
  assert.equal(
    QUIZ_NO_FULL_MATCH_NOTICE,
    "Żadna promocja nie spełnia wszystkich Twoich odpowiedzi. Poniżej są oferty najbliższe – każda ma warunek, którego wolisz nie spełniać."
  );
  assert.equal(QUIZ_RESULT_TITLE_CLOSEST, "Najbliższe Twoim odpowiedziom");
  assert.equal(QUIZ_RESULT_TITLE_FULL, "Twoje dopasowane promocje");
});
