import test from "node:test";
import assert from "node:assert/strict";
import { ratingReasonWarning, summaryLengthWarning, SUMMARY_SOFT_LIMIT } from "../src/lib/promotionForm";

test("ratingReason: relative claims are flagged, plain descriptions are not", () => {
  for (const text of [
    "Najwyższa premia w tej turze",
    "najniższy próg wpływu",
    "Najwyższe wymagania",
    "Jedna z najniższych opłat",
    "Dobra oferta w tym zestawieniu",
    "Wyróżnia się w  tej   turze"
  ]) {
    assert.ok(ratingReasonWarning(text), text);
  }
  for (const text of ["Wysoka premia i niewiele wymaganych czynności.", "", null, undefined]) {
    assert.equal(ratingReasonWarning(text), null);
  }
});

test("summary: warns above the soft limit only, and never blocks", () => {
  assert.equal(summaryLengthWarning("a".repeat(SUMMARY_SOFT_LIMIT)), null);
  assert.equal(summaryLengthWarning(undefined), null);
  assert.match(summaryLengthWarning("a".repeat(SUMMARY_SOFT_LIMIT + 1)) ?? "", /161/);
});
