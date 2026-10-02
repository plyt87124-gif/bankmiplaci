import test from "node:test";
import assert from "node:assert/strict";
import { resolveBonusParts } from "../src/lib/services/promotionImport";
import { overlayDefined } from "../src/lib/promotionContent";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const part = (label: string, extra: Record<string, unknown> = {}) => ({ label, amountCents: 100, order: 0, ...extra });

test("omitted availableUntil is inherited from the single stored part with the same label", () => {
  const { parts, problems } = resolveBonusParts(
    "p",
    [{ label: "Konto", availableUntil: null }, { label: "Kantor", availableUntil: D("2026-09-30") }],
    [part("Konto"), part("Kantor")]
  );
  assert.deepEqual(problems, []);
  assert.equal(parts[0]!.availableUntil, null);
  assert.equal(parts[1]!.availableUntil?.toISOString(), "2026-09-30T00:00:00.000Z");
});

test("labels match on trimmed text, case-sensitively (a rename is not a match)", () => {
  const ok = resolveBonusParts("p", [{ label: "Kantor", availableUntil: D("2026-09-30") }], [part("  Kantor ")]);
  assert.equal(ok.problems.length, 0);
  assert.equal(ok.parts[0]!.availableUntil?.toISOString(), "2026-09-30T00:00:00.000Z");
  const renamed = resolveBonusParts("p", [{ label: "Kantor", availableUntil: D("2026-09-30") }], [part("kantor")]);
  assert.equal(renamed.problems.length, 1, "stored deadline would be deleted with its part");
});

test("explicit null removes, explicit date sets, and an invalid date is a problem", () => {
  const stored = [{ label: "Kantor", availableUntil: D("2026-09-30") }];
  assert.equal(resolveBonusParts("p", stored, [part("Kantor", { availableUntil: null })]).parts[0]!.availableUntil, null);
  assert.equal(
    resolveBonusParts("p", stored, [part("Kantor", { availableUntil: "2026-12-01" })]).parts[0]!.availableUntil?.toISOString(),
    "2026-12-01T00:00:00.000Z"
  );
  assert.equal(resolveBonusParts("p", stored, [part("Kantor", { availableUntil: "01.12.2026" })]).problems.length, 1);
  assert.equal(resolveBonusParts("p", stored, [part("Kantor", { availableUntil: "2026-02-31" })]).problems.length, 1, "impossible day");
});

test("ambiguity is only a problem when a stored deadline would be lost", () => {
  // two stored with the same label, one has a deadline, the file omits it -> abort
  assert.equal(
    resolveBonusParts("p", [{ label: "A", availableUntil: D("2026-09-30") }, { label: "A", availableUntil: null }], [part("A")]).problems.length,
    1
  );
  // same ambiguity but nothing stored to lose -> fine
  assert.equal(resolveBonusParts("p", [{ label: "A", availableUntil: null }, { label: "A", availableUntil: null }], [part("A")]).problems.length, 0);
  // the file has the label twice -> ambiguous for a stored deadline
  assert.equal(
    resolveBonusParts("p", [{ label: "A", availableUntil: D("2026-09-30") }], [part("A"), part("A")]).problems.length,
    1
  );
  // explicit values resolve any ambiguity
  assert.equal(
    resolveBonusParts("p", [{ label: "A", availableUntil: D("2026-09-30") }, { label: "A", availableUntil: null }], [
      part("A", { availableUntil: "2026-09-30" }),
      part("A", { availableUntil: null })
    ]).problems.length,
    0
  );
});

test("a brand-new part and a stored part without a deadline never block an import", () => {
  const r = resolveBonusParts("p", [{ label: "Stara", availableUntil: null }], [part("Nowa")]);
  assert.deepEqual(r.problems, []);
  assert.equal(r.parts[0]!.availableUntil, null);
});

test("overlayDefined models Prisma update semantics: undefined is skipped, null is written", () => {
  const stored = { a: 1, b: "x", c: "kept", d: 5 };
  assert.deepEqual(overlayDefined(stored, { a: undefined, b: null, c: undefined, d: 0 }), { a: 1, b: null, c: "kept", d: 0 });
});
