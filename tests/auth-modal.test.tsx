// Server-render tests of the account forms and the session context (no browser).
// Run with: npx tsx --test tests/auth-modal.test.tsx   (npm test globs *.test.ts only)
// The browser behaviour of the dialog (open/close, Esc, focus, backdrop) is
// verified with Playwright against the dev server, see the WP-07 report.
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Source files use the classic JSX transform under tsx: they need React in scope.
(globalThis as { React?: unknown }).React = React;

const noop = () => {};

async function load() {
  const [{ LoginForm }, { RegisterForm }, session, modal] = await Promise.all([
    import("../src/app/konto/logowanie/LoginForm"),
    import("../src/app/konto/rejestracja/RegisterForm"),
    import("../src/components/SessionProvider"),
    import("../src/app/konto/logowanie/authFlow")
  ]);
  return { LoginForm, RegisterForm, ...session, ...modal };
}

function tag(html: string, name: string): string {
  const match = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  assert.ok(match, `input ${name} not found`);
  return match[0];
}

test("register form: required consent checkbox is NOT pre-ticked and links to the legal pages", async () => {
  const { RegisterForm } = await load();
  const html = renderToStaticMarkup(<RegisterForm onSuccess={noop} />);

  const checkbox = tag(html, "acceptTerms");
  assert.match(checkbox, /type="checkbox"/);
  assert.match(checkbox, /required/);
  assert.doesNotMatch(checkbox, /checked/);
  assert.match(html, /href="\/regulamin"/);
  assert.match(html, /href="\/polityka-prywatnosci"/);
  assert.match(html, /Akceptuję/);
});

test("register form: autocomplete tokens, visible labels, submit through <Button>", async () => {
  const { RegisterForm } = await load();
  const html = renderToStaticMarkup(<RegisterForm onSuccess={noop} />);

  assert.match(tag(html, "name"), /autoComplete="given-name"/);
  assert.match(tag(html, "username"), /autoComplete="username"/);
  assert.match(tag(html, "email"), /autoComplete="email"/);
  assert.match(tag(html, "email"), /type="email"/);
  assert.match(tag(html, "password"), /autoComplete="new-password"/);
  assert.match(tag(html, "password"), /type="password"/);

  for (const label of ["Imię (opcjonalnie)", "Nazwa użytkownika", "E-mail", "Hasło"]) {
    assert.ok(html.includes(label), `label ${label}`);
  }
  // every input has a <label for=id> with the same id
  for (const input of html.match(/<input[^>]*id="([^"]+)"/g) ?? []) {
    const id = /id="([^"]+)"/.exec(input)![1];
    assert.ok(html.includes(`for="${id}"`), `label for ${id}`);
  }
  assert.match(html, /<button type="submit"[^>]*bg-action[^>]*>Załóż konto<\/button>/);
  assert.doesNotMatch(html, /border-ink-100|bg-ink-solid|text-ink-300/);
});

test("login form: autocomplete tokens and no error message before the first submit", async () => {
  const { LoginForm } = await load();
  const html = renderToStaticMarkup(<LoginForm onSuccess={noop} />);

  assert.match(tag(html, "identifier"), /autoComplete="username"/);
  assert.match(tag(html, "password"), /autoComplete="current-password"/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.doesNotMatch(html, /aria-invalid/);
  assert.match(html, /Zaloguj się<\/button>/);
});

test("toSessionUser keeps only id and name", async () => {
  const { toSessionUser } = await load();
  assert.deepEqual(
    toSessionUser({ id: "u1", name: "Jan", email: "jan@example.com", createdAt: new Date(), passwordHash: "x" }),
    { id: "u1", name: "Jan" }
  );
  assert.deepEqual(toSessionUser({ id: "u1", name: null }), { id: "u1", name: null });
  assert.equal(toSessionUser(null), null);
  assert.equal(toSessionUser(undefined), null);
  assert.equal(toSessionUser({ name: "x" }), null);
  assert.equal(toSessionUser({ id: "", name: "x" }), null);
  assert.equal(toSessionUser("u1"), null);
});

test("SessionProvider: initial value from props, no loading flash", async () => {
  const { SessionProvider, useSession } = await load();
  function Probe() {
    const { user, status } = useSession();
    return <p>{`${status}:${user ? `${user.id}/${user.name}` : "-"}`}</p>;
  }
  const withUser = renderToStaticMarkup(
    <SessionProvider initialUser={{ id: "u1", name: "Jan" }}>
      <Probe />
    </SessionProvider>
  );
  assert.match(withUser, /authenticated:u1\/Jan/);

  const signedOut = renderToStaticMarkup(
    <SessionProvider initialUser={null}>
      <Probe />
    </SessionProvider>
  );
  assert.match(signedOut, /unauthenticated:-/);

  // nothing passed (WP-17 mode): unknown until /api/account/me answers
  const unknown = renderToStaticMarkup(
    <SessionProvider>
      <Probe />
    </SessionProvider>
  );
  assert.match(unknown, /loading:-/);
});

test("useSession outside a provider fails loudly", async () => {
  const { useSession } = await load();
  function Probe() {
    useSession();
    return null;
  }
  assert.throws(() => renderToStaticMarkup(<Probe />), /SessionProvider/);
});
