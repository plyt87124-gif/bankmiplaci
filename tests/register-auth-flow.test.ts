import test from "node:test";
import assert from "node:assert/strict";
import {
  createBackdropCloseTracker,
  firstParam,
  isOutsideRect,
  safeRedirectPath
} from "../src/app/konto/logowanie/authFlow";

test("safeRedirectPath keeps paths on this site (with query and hash)", () => {
  assert.equal(safeRedirectPath("/promocje/alior-konto", "/konto"), "/promocje/alior-konto");
  assert.equal(safeRedirectPath("/promocje?sort=easiest&q=a%20b#opis", "/konto"), "/promocje?sort=easiest&q=a%20b#opis");
  assert.equal(safeRedirectPath("/", "/konto"), "/");
});

test("safeRedirectPath refuses anything that could leave the site", () => {
  const attacks = [
    "https://evil.example/phish",
    "http://evil.example",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "evil.example",
    "promocje",
    "",
    "/ok\u0000"
  ];
  for (const attack of attacks) {
    assert.equal(safeRedirectPath(attack, "/konto"), "/konto", `must reject ${JSON.stringify(attack)}`);
  }
  assert.equal(safeRedirectPath(undefined, "/konto"), "/konto");
  assert.equal(safeRedirectPath(null, "/konto"), "/konto");
});

test("firstParam takes the first value of a repeated query parameter", () => {
  assert.equal(firstParam("a"), "a");
  assert.equal(firstParam(["a", "b"]), "a");
  assert.equal(firstParam(undefined), undefined);
  assert.equal(firstParam([]), undefined);
});

const rect = { left: 100, right: 500, top: 50, bottom: 450 };

test("isOutsideRect separates the backdrop from the dialog box", () => {
  assert.equal(isOutsideRect({ x: 300, y: 200 }, rect), false);
  assert.equal(isOutsideRect({ x: 100, y: 50 }, rect), false); // edge = inside
  assert.equal(isOutsideRect({ x: 99, y: 200 }, rect), true);
  assert.equal(isOutsideRect({ x: 501, y: 200 }, rect), true);
  assert.equal(isOutsideRect({ x: 300, y: 49 }, rect), true);
  assert.equal(isOutsideRect({ x: 300, y: 451 }, rect), true);
});

test("backdrop closes the dialog only when press AND release are on it", () => {
  const t = createBackdropCloseTracker();

  t.down(true);
  assert.equal(t.up(true), true, "press + release on the backdrop closes");

  t.down(false);
  assert.equal(t.up(true), false, "selecting text inside and releasing outside must not close");

  t.down(true);
  assert.equal(t.up(false), false, "pressing outside and releasing inside must not close");

  assert.equal(t.up(true), false, "a release with no matching press never closes");

  t.down(true);
  t.reset();
  assert.equal(t.up(true), false, "reset forgets the press");
});

test("safeRedirectPath rejects dot-segment tricks that normalise to a protocol-relative URL", () => {
  for (const raw of ["/.//evil.example", "/a/..//evil.example", "/%2e//evil.example", "/x/%2e%2e//evil.example"]) {
    assert.equal(safeRedirectPath(raw, "/konto"), "/konto", raw);
  }
});
