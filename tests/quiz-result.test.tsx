// The result screen of the quiz: heading and notice depend on whether any proposal fits ALL the answers.
// Run: npx tsx --test tests/quiz-result.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizResult } from "../src/app/quiz/QuizClient";
import {
  QUIZ_NO_FULL_MATCH_NOTICE,
  matchOffers,
  type QuizAnswers,
  type QuizOffer
} from "../src/lib/quiz";

(globalThis as { React?: unknown }).React = React;

function offer(slug: string, overrides: Partial<QuizOffer> = {}): QuizOffer {
  return {
    slug,
    name: `Oferta ${slug}`,
    bank: { name: `Bank ${slug}`, slug: `bank-${slug}`, logoUrl: null },
    accountType: "PERSONAL",
    difficulty: "EASY",
    maxBonusCents: 50_000,
    rating: 8,
    endDate: "2099-12-31T00:00:00.000Z",
    needsCardPayments: false,
    needsInflow: false,
    ...overrides
  };
}

const ANSWERS: QuizAnswers = { effort: "low", audience: "personal", canCardPay: false, canInflow: true, topBonus: false };
const noop = () => undefined;
const render = (offers: QuizOffer[]) =>
  renderToStaticMarkup(
    <QuizResult
      matches={matchOffers(offers, ANSWERS)}
      audience="personal"
      titleRef={{ current: null }}
      onChange={noop}
      onRestart={noop}
    />
  );
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("nothing fits all the answers: a notice above the result, 'Najbliższe Twoim odpowiedziom', the short caution", () => {
  const out = render([offer("a", { needsCardPayments: true }), offer("b", { needsCardPayments: true })]);
  assert.match(out, /<h2[^>]*>Najbliższe Twoim odpowiedziom<\/h2>/);
  assert.doesNotMatch(out, /Twoje dopasowane promocje/);
  assert.ok(text(out).includes(QUIZ_NO_FULL_MATCH_NOTICE));
  assert.match(out, /<p role="status"[^>]*>Żadna promocja nie spełnia wszystkich Twoich odpowiedzi\./);
  assert.ok(out.indexOf("Żadna promocja nie spełnia") < out.indexOf("<ol"), "the notice is above the list");
  assert.equal((text(out).match(/Możesz nie dostać całej premii\./g) ?? []).length, 2, "one caution per offer");
  assert.doesNotMatch(out, /poza zasięgiem/);
});

test("a full match: the plain heading and no notice", () => {
  const out = render([offer("a"), offer("b")]);
  assert.match(out, /<h2[^>]*>Twoje dopasowane promocje<\/h2>/);
  assert.doesNotMatch(out, /Żadna promocja nie spełnia|Najbliższe Twoim odpowiedziom/);
});

test("a mix (one fits everything, one does not): no 'nothing fits' notice, but the heading is not a full-match claim", () => {
  const out = render([offer("a"), offer("b", { needsCardPayments: true })]);
  assert.doesNotMatch(out, /Żadna promocja nie spełnia/);
  assert.match(out, /<h2[^>]*>Najbliższe Twoim odpowiedziom<\/h2>/);
  assert.equal((text(out).match(/Możesz nie dostać całej premii\./g) ?? []).length, 1);
});
