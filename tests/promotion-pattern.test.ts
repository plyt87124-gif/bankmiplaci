// Wzorzec promocji (docs/wzorzec-promocji.md): każdy NOWY plik kandydata (sprawdzony 15.11.2026 lub później) trzyma się
// zasad właściciela, które da się sprawdzić maszynowo. Starsze pliki (przed tą datą) nie są skanowane: mają znane odstępstwa
// (np. wzmianki o bankomatach w otherFee), które właściciel zatwierdził w czasie, gdy zasada jeszcze nie obowiązywała.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { feeWaiverProblems } from "../src/lib/feeValidation";
import { offerCopyProblems } from "../src/lib/offerCopyRules";
import { resolveFee } from "../src/lib/feeModel";
import { SUMMARY_SOFT_LIMIT } from "../src/lib/promotionForm";

const DIR = path.join(process.cwd(), "data", "candidates");
const SINCE = "2026-11-15";
type Candidate = { promotion: Record<string, any>; checklistSteps?: { order: number; monthLabel: string; rewardCents?: number }[] };
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
const fresh = files
  .map((f) => ({ f, c: JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Candidate }))
  .filter(({ c }) => String(c.promotion?.lastVerifiedAt ?? "") >= SINCE);

test("są nowe pliki kandydatów do sprawdzenia (BNP z 15.11.2026)", () => {
  assert.ok(fresh.length >= 2, "oczekiwano co najmniej dwóch plików BNP z 15.11.2026");
});

for (const { f, c } of fresh) {
  const p = c.promotion;

  test(`${f}: opłaty wg wzorca (stawka bez zwolnienia, warunek po „0 zł gdy”, bez bankomatów)`, () => {
    const fees = p.fees ?? {};
    assert.deepEqual(feeWaiverProblems(fees), []);
    assert.equal(fees.atmFeeCents ?? null, null, "atmFeeCents zostaje puste");
    assert.doesNotMatch(fees.otherFee ?? "", /bankomat/i, "otherFee bez bankomatów");
    assert.ok(fees.sourceUrl && !/regulamin/i.test(fees.sourceUrl), "fees.sourceUrl to taryfa lub dokument opłat, nigdy regulamin");
    // strona czyta opłatę tym samym modelem; konto i karta nie mogą wyjść jako „Brak danych” bez powodu zapisanego w raporcie
    for (const [cents, waiver] of [[fees.accountFeeCents, fees.accountFeeWaiverCondition], [fees.cardFeeCents, fees.cardFeeWaiverCondition]] as const) {
      assert.notEqual(resolveFee(cents, waiver).kind, "unknown", `opłata ${cents}/${waiver} jest nieustalona`);
    }
  });

  test(`${f}: teksty oferty bez zakazanych zdań, „kto może” bez dat karencji, „kto nie może” nie jest lustrem`, () => {
    assert.deepEqual(offerCopyProblems(p.slug, p as never), []);
    assert.ok(String(p.summary ?? "").length > 0 && String(p.summary).length <= SUMMARY_SOFT_LIMIT, `summary ma ${String(p.summary).length} znaków (miękki limit ${SUMMARY_SOFT_LIMIT})`);
    const datePattern = /\d{1,2}\.\d{1,2}\.\d{4}|\d+\s+miesi[ęe]c/i;
    if (p.cooldownMonths != null || p.cooldownCutoffDate) {
      assert.doesNotMatch(p.eligibleFor ?? "", datePattern, "karencja tylko w cooldownMonths / cooldownCutoffDate");
      assert.doesNotMatch(p.notEligibleFor ?? "", datePattern, "karencja tylko w cooldownMonths / cooldownCutoffDate");
    }
    assert.ok(!/^(osoby|klienci|firmy)[^.]*\b(w ostatnich|w okresie)\b/i.test(p.notEligibleFor ?? ""), "„kto nie może” nie przepisuje „kto może” od końca");
  });

  test(`${f}: sumy zgadzają się (części premii i nagrody w ściądze = maxBonusCents), jedna nagroda w grupie`, () => {
    const max = p.maxBonusCents as number;
    assert.equal((p.bonusParts as { amountCents: number }[]).reduce((s, b) => s + b.amountCents, 0), max);
    const steps = c.checklistSteps ?? [];
    assert.equal(steps.reduce((s, x) => s + (x.rewardCents ?? 0), 0), max);
    const rewardsPerGroup = new Map<string, number>();
    for (const s of steps) if (s.rewardCents) rewardsPerGroup.set(s.monthLabel, (rewardsPerGroup.get(s.monthLabel) ?? 0) + 1);
    for (const [label, n] of rewardsPerGroup) assert.equal(n, 1, `grupa „${label}” ma ${n} nagród (najwyżej jedna)`);
  });

  test(`${f}: źródła i daty (regulamin, strona, taryfa; ostatni dzień zapisów; weryfikacja)`, () => {
    assert.match(String(p.sourceUrl), /^https:\/\//);
    assert.ok(Array.isArray(p.additionalSourceUrls) && p.additionalSourceUrls.length >= 2, "strona promocji i taryfa w additionalSourceUrls");
    assert.match(String(p.endDate), /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(String(p.endDate) >= String(p.startDate));
    assert.equal(p.status, "DRAFT", "plik kandydata zawsze DRAFT; ACTIVE nadaje flaga skryptu");
  });
}
