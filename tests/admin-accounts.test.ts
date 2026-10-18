import test from "node:test";
import assert from "node:assert/strict";
import { getSwitchAccounts } from "../src/lib/adminAccounts";

test("switch accounts come from the two env variables, lower-cased, and are absent when unset", () => {
  assert.deepEqual(getSwitchAccounts({}), []);
  assert.deepEqual(getSwitchAccounts({ ADMIN_TEST_USER_EMAIL: " Test@Example.com ", ADMIN_OWN_USER_EMAIL: "me@example.com" }), [
    { key: "tester", label: "Konto testowe", email: "test@example.com" },
    { key: "own", label: "Moje konto", email: "me@example.com" }
  ]);
  assert.deepEqual(getSwitchAccounts({ ADMIN_OWN_USER_EMAIL: "me@example.com" }).map((a) => a.key), ["own"]);
});
