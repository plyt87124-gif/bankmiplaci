// Wording and validation of the contact, sign-up and sign-in forms (F2B):
// full sentences with a full stop, empty fields asked for (not "too short"),
// one description of the account, impersonal forms, titles equal to the H1.
// Run: npx tsx --test tests/forms-validation.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONTACT_EMAIL_INVALID,
  CONTACT_EMAIL_REQUIRED,
  CONTACT_MESSAGE_INVALID,
  ContactForm,
  MESSAGE_MAX,
  MESSAGE_MIN,
  validateContactValues
} from "../src/app/kontakt/ContactForm";
import { ACCOUNT_BENEFITS, AUTH_INTROS, finishSentence } from "../src/app/konto/logowanie/authFlow";
import { REGISTER_REQUIRED_MESSAGES, validateRegisterForm } from "../src/app/konto/rejestracja/registerMessages";
import { forgotEmailError } from "../src/app/konto/zapomniane-haslo/ForgotPasswordForm";

(globalThis as { React?: unknown }).React = React;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const GOOD = { name: "", username: "jan_kowalski", email: "jan@example.pl", password: "tajne-haslo-1", acceptTerms: true };

/* ---------------- contact ---------------- */

test("contact: the limits are the endpoint's (5 to 4000 characters)", async () => {
  assert.equal(MESSAGE_MIN, 5);
  assert.equal(MESSAGE_MAX, 4000);
  const { readFileSync } = await import("node:fs");
  const route = readFileSync("src/app/api/contact/route.ts", "utf8");
  assert.match(route, /z\.string\(\)\.min\(5\)\.max\(4000\)/);
});

test("contact: empty fields get a full-sentence message under the field", () => {
  assert.deepEqual(validateContactValues({ email: "", message: "" }), {
    email: "Podaj adres e-mail.",
    message: "Napisz wiadomość (od 5 do 4000 znaków)."
  });
  assert.deepEqual(validateContactValues({ email: "   ", message: "     " }), {
    email: CONTACT_EMAIL_REQUIRED,
    message: CONTACT_MESSAGE_INVALID
  });
});

test("contact: a filled but wrong value is told apart from an empty one", () => {
  assert.equal(validateContactValues({ email: "nie-adres", message: "Dzień dobry" }).email, CONTACT_EMAIL_INVALID);
  assert.equal(CONTACT_EMAIL_INVALID, "Podaj poprawny adres e-mail.");
  assert.equal(validateContactValues({ email: "a@b.pl", message: "abcd" }).message, CONTACT_MESSAGE_INVALID, "4 characters is too short");
  assert.equal(validateContactValues({ email: "a@b.pl", message: "x".repeat(MESSAGE_MAX + 1) }).message, CONTACT_MESSAGE_INVALID);
  assert.deepEqual(validateContactValues({ email: " a@b.pl ", message: "abcde" }), {});
  assert.deepEqual(validateContactValues({ email: "a@b.pl", message: "x".repeat(MESSAGE_MAX) }), {});
});

test("contact: the form validates itself (noValidate), keeps its fields, names and the endpoint body", async () => {
  const html = renderToStaticMarkup(<ContactForm initialMessage="Dotyczy oferty: konto-x" />);
  assert.match(html, /<form[^>]*noValidate=""|<form[^>]*novalidate=""/i);
  assert.match(html, /name="email"/);
  assert.match(html, /name="message"/);
  assert.match(html, /Dotyczy oferty: konto-x/);
  assert.doesNotMatch(html, /minLength|minlength/, "no native length bubble");
  assert.doesNotMatch(html, /aria-invalid|role="alert"/, "no error before the first submit");
  assert.match(text(html), /Od 5 do 4000 znaków\./);
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/app/kontakt/ContactForm.tsx", "utf8");
  assert.match(src, /JSON\.stringify\(\{ email: form\.get\("email"\), message: form\.get\("message"\) \}\)/);
  assert.match(src, /\(problems\.email \? emailRef : messageRef\)\.current\?\.focus\(\)/, "focus goes to the first invalid field");
});

/* ---------------- sign-up ---------------- */

test("sign-up: nothing wrong, no messages", () => {
  assert.deepEqual(validateRegisterForm(GOOD), {});
});

test("sign-up: an empty username, e-mail and password are asked for, not reported as too short", () => {
  const errors = validateRegisterForm({ ...GOOD, username: "", email: "", password: "" });
  assert.equal(errors.username, "Podaj nazwę użytkownika.");
  assert.equal(errors.email, "Podaj adres e-mail.");
  assert.equal(errors.password, "Podaj hasło.");
  assert.deepEqual(REGISTER_REQUIRED_MESSAGES, { username: "Podaj nazwę użytkownika.", email: "Podaj adres e-mail.", password: "Podaj hasło." });
  // whitespace only is empty too
  assert.equal(validateRegisterForm({ ...GOOD, username: "   " }).username, "Podaj nazwę użytkownika.");
});

test("sign-up: a filled but wrong value keeps its own message, always a full sentence with a full stop", () => {
  const errors = validateRegisterForm({ ...GOOD, username: "ab", email: "zly", password: "krotki", acceptTerms: false });
  assert.equal(errors.username, "Nazwa użytkownika musi mieć min. 3 znaki.");
  assert.equal(errors.email, "Podaj poprawny adres e-mail.");
  assert.equal(errors.password, "Hasło musi mieć min. 8 znaków.");
  assert.match(errors.acceptTerms ?? "", /Regulamin.*Polityk/);
  assert.equal(validateRegisterForm({ ...GOOD, username: "jan kowalski" }).username, "Dozwolone tylko litery, cyfry i podkreślenia.");
  assert.equal(validateRegisterForm({ ...GOOD, name: "x".repeat(81) }).name, "Imię może mieć max. 80 znaków.");
  for (const message of Object.values(errors)) assert.match(message, /[.!?]$/);
});

test("finishSentence adds a full stop only where there is no sentence ending", () => {
  assert.equal(finishSentence("Podaj hasło"), "Podaj hasło.");
  assert.equal(finishSentence("Podaj hasło."), "Podaj hasło.");
  assert.equal(finishSentence(" Na pewno? "), "Na pewno?");
});

test("sign-up form: impersonal hint, no gendered slashes, the same message style as the sign-in form", async () => {
  const { readFileSync } = await import("node:fs");
  const form = readFileSync("src/app/konto/rejestracja/RegisterForm.tsx", "utf8");
  assert.ok(form.includes("Zalogujesz się tą nazwą zamiast e-maila. 3–20 znaków: litery, cyfry, podkreślenia."));
  assert.doesNotMatch(form, /mógł\/mogła|zamiast e-mailem/);
  const login = readFileSync("src/app/konto/logowanie/LoginForm.tsx", "utf8");
  assert.ok(login.includes('"Podaj e-mail lub nazwę użytkownika."') && login.includes('"Podaj hasło."'));
});

/* ---------------- account description, titles ---------------- */

test("one description of the account for /konto/logowanie, /konto/rejestracja and the modal's sign-up tab", async () => {
  assert.equal(
    ACCOUNT_BENEFITS,
    "Konto pozwala komentować promocje, prowadzić ściągę i sprawdzać, od kiedy można skorzystać po okresie karencji. Nie łączymy się z kontem bankowym – korzystamy tylko z danych wpisanych przez Ciebie (np. dat otwarcia i zamknięcia kont)."
  );
  assert.equal(AUTH_INTROS.register, ACCOUNT_BENEFITS);
  assert.doesNotMatch(AUTH_INTROS.login, /byłeś|\/aś/);
  assert.doesNotMatch(ACCOUNT_BENEFITS, /\/a\b|\(a\)|historię bankową/);

  // The pages render a client form that needs the app router, so the wiring is checked in the source.
  const { readFileSync } = await import("node:fs");
  for (const file of ["src/app/konto/rejestracja/page.tsx", "src/app/konto/logowanie/page.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /intro=\{ACCOUNT_BENEFITS\}/, file);
  }
});

test("the title of each account page equals its H1", async () => {
  const { readFileSync } = await import("node:fs");
  const pages = [
    { file: "src/app/konto/rejestracja/page.tsx", mod: await import("../src/app/konto/rejestracja/page"), h1: "Załóż konto" },
    { file: "src/app/konto/logowanie/page.tsx", mod: await import("../src/app/konto/logowanie/page"), h1: "Zaloguj się" },
    { file: "src/app/konto/zapomniane-haslo/page.tsx", mod: await import("../src/app/konto/zapomniane-haslo/page"), h1: "Nie pamiętasz hasła?" }
  ];
  for (const { file, mod, h1 } of pages) {
    assert.equal(mod.metadata.title, h1, file);
    assert.ok(readFileSync(file, "utf8").includes(`<AuthCard title="${h1}"`), `${file}: the H1 (AuthCard title)`);
  }
});

/* ---------------- forgot password ---------------- */

test("forgot password: an empty field asks for the address, a wrong one says it is not valid", () => {
  assert.equal(forgotEmailError(""), "Podaj adres e-mail.");
  assert.equal(forgotEmailError("  "), "Podaj adres e-mail.");
  assert.equal(forgotEmailError("abc"), "Podaj poprawny adres e-mail.");
});
