import test from "node:test";
import assert from "node:assert/strict";
import { describeAdditionalSource, describeFeesSource } from "../src/lib/sourceLinks";
import { formatCooldownWindow } from "../src/lib/cooldownText";

test("labels fee documents by what they are", () => {
  assert.equal(
    describeAdditionalSource("https://www.aliorbank.pl/dam/jcr:1a36/ddo-ror-alior-konto.pdf", 1),
    "dokument informacyjny o opłatach"
  );
  assert.equal(
    describeAdditionalSource("https://www.aliorbank.pl/dam/jcr:2c55/toip-konta-osobiste.pdf", 2),
    "taryfa opłat i prowizji"
  );
});

test("labels offer pages and regulamins", () => {
  assert.equal(
    describeAdditionalSource("https://www.aliorbank.pl/klienci-indywidualni/konta-osobiste/alior-konto-18-25-lat.html", 0),
    "strona promocyjna banku (aliorbank.pl)"
  );
  assert.equal(
    describeAdditionalSource(
      "https://static.credit-agricole.pl/asset/r/e/g/regulamin-promocji-zyskaj-do-300-zl-zwrotow-za-zakupy_36263.pdf",
      0
    ),
    "regulamin: zyskaj do 300 zl zwrotow za zakupy"
  );
});

test("falls back to a numbered document when the file name says nothing", () => {
  assert.equal(
    describeAdditionalSource("https://www.pkobp.pl/api/public/c9016e68-14d5-4bc1-922b-6bb79832a58a.pdf", 0),
    "dodatkowy dokument 1 (pkobp.pl)"
  );
});

test("fees source label distinguishes DDO from tariff", () => {
  assert.equal(describeFeesSource("https://x.pl/dam/ddo-ror-alior-konto.pdf"), "Dokument informacyjny o opłatach");
  assert.equal(describeFeesSource("https://x.pl/tabela-oplat.pdf"), "Taryfa opłat i prowizji");
});

test("cooldown window wording", () => {
  assert.equal(formatCooldownWindow(36), "w ciągu ostatnich 36 miesięcy (3 lat)");
  assert.equal(formatCooldownWindow(12), "w ciągu ostatnich 12 miesięcy (1 roku)");
  assert.equal(formatCooldownWindow(18), "w ciągu ostatnich 18 miesięcy");
  assert.equal(formatCooldownWindow(1), "w ciągu ostatniego miesiąca");
});
