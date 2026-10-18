import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMENTS_NOTE,
  COMPACT,
  DISCLOSURE_LINKS,
  FOOTER,
  LATEST_VERIFICATION_LABEL,
  MARKET_SCOPE_NOTE,
  NOT_BANK_NOTE,
  SORT_RECOMMENDED_LABEL,
  STRIP_OTHER,
  STRIP_RECOMMENDED,
  disclosureText,
  isRecommendedSort,
  sortDescriptionCopy,
  stripCopy
} from "../src/lib/disclosureCopy";

// Wording is fixed by docs/redesign-v2/04-trust-and-disclosure-plan.md section 2.
// If one of these assertions has to change, the lawyer's text changed: update
// the plan and get it reviewed first.

test("strip for other sort orders is the general affiliate sentence", () => {
  assert.equal(
    disclosureText(STRIP_OTHER),
    "Część linków to linki partnerskie – możemy otrzymać wynagrodzenie od banku. Jak zarabiamy"
  );
  assert.equal(STRIP_OTHER.href, DISCLOSURE_LINKS.howWeEarn);
});

test("stripCopy: no sort at all means 'recommended' (the listing's default), like the services", () => {
  assert.equal(stripCopy(undefined), STRIP_RECOMMENDED);
  assert.equal(stripCopy(null), STRIP_RECOMMENDED);
  // "?sort=" (empty) is NOT the recommended order in the services, so it must not claim it.
  assert.equal(stripCopy(""), STRIP_OTHER);
  assert.equal(stripCopy("recommended"), STRIP_RECOMMENDED);
  for (const sort of ["top-rated", "highest-bonus", "easiest", "newest", "ending-soon", "junk"]) {
    assert.equal(stripCopy(sort), STRIP_OTHER, sort);
  }
  assert.equal(isRecommendedSort("top-rated"), false);
});

test("compact disclosure", () => {
  assert.equal(disclosureText(COMPACT), "Link partnerski: możemy otrzymać wynagrodzenie od banku. Jak zarabiamy");
  assert.equal(COMPACT.href, "/jak-zarabiamy");
});

test("footer disclosure replaces the old 'not an official partner' claim", () => {
  const text = disclosureText(FOOTER);
  assert.equal(
    text,
    "Bankmiplaci nie jest bankiem ani oficjalnym przedstawicielem banków. " +
      "Część linków to linki partnerskie – za otwarcie konta przez nasz link możemy otrzymać wynagrodzenie od banku lub sieci partnerskiej. " +
      "Co do zasady nie zmienia to warunków oferty ani naszej oceny; jeśli promocja wymaga otwarcia konta przez link lub kod, sprawdź to w jej warunkach i w regulaminie banku. " +
      "Nazwy i logotypy banków należą do ich właścicieli i służą wyłącznie identyfikacji oferty. " +
      "Nie porównujemy całego rynku. Nie jest to doradztwo finansowe. Jak zarabiamy"
  );
  assert.ok(!/oficjalnym partnerem/i.test(text));
});

test("one name for the date of the newest verification, everywhere", () => {
  assert.equal(LATEST_VERIFICATION_LABEL, "Najnowsza weryfikacja oferty");
});

test("standing notes", () => {
  assert.equal(NOT_BANK_NOTE, "Nie jesteśmy bankiem ani doradcą. Warunki ustala bank.");
  assert.equal(COMMENTS_NOTE, "Opinie użytkowników – nie weryfikujemy ich. Nie stanowią porady.");
  assert.equal(
    disclosureText(MARKET_SCOPE_NOTE),
    "Nie obejmujemy całego rynku – pokazujemy promocje, które przeanalizowaliśmy. To nie jest doradztwo finansowe. Jak liczymy ocenę"
  );
});

test("no copy item promises 'you do not pay more' before the lawyer approves it", () => {
  const all = [STRIP_RECOMMENDED, STRIP_OTHER, COMPACT, FOOTER, MARKET_SCOPE_NOTE].map(disclosureText).join(" ");
  assert.ok(!/nie płacisz więcej/i.test(all));
});

test("every disclosure link target is an internal path", () => {
  for (const copy of [STRIP_RECOMMENDED, STRIP_OTHER, COMPACT, FOOTER, MARKET_SCOPE_NOTE, sortDescriptionCopy("top-rated")]) {
    assert.match(copy.href, /^\/[a-z-]+(#[a-z-]+)?$/);
  }
});
