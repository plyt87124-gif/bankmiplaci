import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCEPT_TERMS_MESSAGE,
  TERMS_VERSION,
  fieldErrorsFromIssues,
  parseRegisterRequest,
  validateRegisterValues
} from "../src/app/api/account/register/registerInput";

const valid = {
  email: "jan@example.com",
  username: "jan_kowalski",
  password: "dlugie-haslo-1",
  name: "Jan",
  acceptTerms: true
};

test("TERMS_VERSION is a single YYYY-MM string", () => {
  assert.match(TERMS_VERSION, /^\d{4}-(0[1-9]|1[0-2])$/);
});

test("registration with the consent is accepted", () => {
  const result = parseRegisterRequest(valid);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.acceptTerms, true);
    assert.equal(result.data.username, "jan_kowalski");
  }
});

test("registration WITHOUT the consent field is rejected (old clients, curl)", () => {
  const { acceptTerms: _omitted, ...withoutConsent } = valid;
  const result = parseRegisterRequest(withoutConsent);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.field, "acceptTerms");
    assert.equal(result.error, ACCEPT_TERMS_MESSAGE);
  }
});

test("anything other than boolean true is not consent", () => {
  for (const value of [false, "true", "on", 1, null, undefined, [], {}]) {
    const result = parseRegisterRequest({ ...valid, acceptTerms: value });
    assert.equal(result.success, false, `acceptTerms=${JSON.stringify(value)} must be rejected`);
    if (!result.success) assert.equal(result.fieldErrors.acceptTerms, ACCEPT_TERMS_MESSAGE);
  }
});

test("a non-object body is rejected without throwing", () => {
  for (const body of [null, undefined, "x", 42, []]) {
    assert.equal(parseRegisterRequest(body).success, false);
  }
});

test("the first problem is reported as error + field, all of them in fieldErrors", () => {
  const result = parseRegisterRequest({ ...valid, email: "nie-email", password: "krotkie", acceptTerms: false });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.fieldErrors.email, "Podaj poprawny adres e-mail");
    assert.equal(result.fieldErrors.password, "Hasło musi mieć min. 8 znaków");
    assert.equal(result.fieldErrors.acceptTerms, ACCEPT_TERMS_MESSAGE);
    assert.ok(result.field && result.fieldErrors[result.field] === result.error);
  }
});

test("existing username/password rules still apply", () => {
  assert.equal(parseRegisterRequest({ ...valid, username: "ab" }).success, false);
  assert.equal(parseRegisterRequest({ ...valid, username: "a".repeat(21) }).success, false);
  assert.equal(parseRegisterRequest({ ...valid, username: "ma spacje" }).success, false);
  assert.equal(parseRegisterRequest({ ...valid, password: "1234567" }).success, false);
  assert.equal(parseRegisterRequest({ ...valid, password: "12345678" }).success, true);
});

test("name is optional, trimmed and length-limited", () => {
  const noName: Record<string, unknown> = { ...valid };
  delete noName.name;
  assert.equal(parseRegisterRequest(noName).success, true);

  const trimmed = parseRegisterRequest({ ...valid, name: "  Jan  " });
  assert.equal(trimmed.success && trimmed.data.name, "Jan");

  assert.equal(parseRegisterRequest({ ...valid, name: "x".repeat(81) }).success, false);
});

test("validateRegisterValues mirrors the server rules for the form", () => {
  assert.deepEqual(
    validateRegisterValues({ name: "", username: " jan_k ", email: " jan@example.com ", password: "dlugie-haslo-1", acceptTerms: true }),
    {}
  );

  const errors = validateRegisterValues({ name: "", username: "", email: "", password: "", acceptTerms: false });
  assert.deepEqual(Object.keys(errors).sort(), ["acceptTerms", "email", "password", "username"]);
  assert.equal(errors.acceptTerms, ACCEPT_TERMS_MESSAGE);
});

test("fieldErrorsFromIssues keeps the first message per known field and ignores the rest", () => {
  assert.deepEqual(
    fieldErrorsFromIssues([
      { path: ["email"], message: "a" },
      { path: ["email"], message: "b" },
      { path: ["unknown"], message: "c" },
      { path: [], message: "d" }
    ]),
    { email: "a" }
  );
});
