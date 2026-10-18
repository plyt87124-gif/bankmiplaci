// Server-render test of /konto/zapomniane-haslo. Run: npx tsx --test tests/forgot-password-page.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: unknown }).React = React;

test("forgot-password page: one h1, labelled email field, submit, back link, metadata title", async () => {
  const mod = await import("../src/app/konto/zapomniane-haslo/page");
  const html = renderToStaticMarkup(<mod.default />);

  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert.match(html, /<label[^>]*>E-mail/);
  assert.match(html, /<input[^>]*name="email"[^>]*type="email"|<input[^>]*type="email"[^>]*name="email"/);
  assert.match(html, /autoComplete="email"|autocomplete="email"/);
  assert.match(html, /Wyślij link resetujący/);
  assert.match(html, /href="\/konto\/logowanie"/);
  assert.doesNotMatch(html, /border-ink-100|bg-ink-solid|text-xs|break-all/);
  assert.equal((mod.metadata.title as string), "Nie pamiętasz hasła?");
});

test("forgot-password page: the status region and the focus target are in the DOM from the start, empty", async () => {
  const mod = await import("../src/app/konto/zapomniane-haslo/page");
  const html = renderToStaticMarkup(<mod.default />);
  // The live region exists before success (an empty region is announced reliably when text is added)...
  assert.match(html, /<div role="status"><\/div>/);
  // ...and sits inside the container that receives focus once the form is gone.
  assert.match(html, /<div tabindex="-1"[^>]*><div role="status"><\/div><\/div>/);
  // No success text and no developer panel before a request.
  assert.doesNotMatch(html, /wysłaliśmy link|Tryb deweloperski/);
});

test("forgot-password form: developer panel does not claim that e-mail sending is missing", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const src = readFileSync(join(process.cwd(), "src", "app", "konto", "zapomniane-haslo", "ForgotPasswordForm.tsx"), "utf8");
  assert.ok(!/nie jest jeszcze podłączona/.test(src));
  assert.ok(src.includes("Tryb deweloperski — link resetu pokazany bezpośrednio na stronie."));
  assert.ok(/resultRef\.current\?\.focus\(\)/.test(src), "focus moves to the message container after success");
});

// --- requestReset: every branch, with fetch replaced ---------------------------

type FetchCall = { url: string; init: RequestInit };

async function withFetch<T>(impl: (url: string, init: RequestInit) => Promise<Response>, run: () => Promise<T>) {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return impl(url, init);
  }) as typeof fetch;
  try {
    return { value: await run(), calls };
  } finally {
    globalThis.fetch = original;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("requestReset: posts the e-mail as JSON to the forgot-password endpoint", async () => {
  const { requestReset } = await import("../src/app/konto/zapomniane-haslo/requestReset");
  const { value, calls } = await withFetch(async () => json({ ok: true }), () => requestReset("a@b.pl"));
  assert.deepEqual(value, { ok: true, devResetUrl: undefined });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "/api/account/forgot-password");
  assert.equal(calls[0]!.init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { email: "a@b.pl" });
});

test("requestReset: a network failure becomes a message, never an exception", async () => {
  const { requestReset, NETWORK_ERROR } = await import("../src/app/konto/zapomniane-haslo/requestReset");
  const { value } = await withFetch(async () => { throw new TypeError("Failed to fetch"); }, () => requestReset("a@b.pl"));
  assert.deepEqual(value, { ok: false, error: NETWORK_ERROR });
});

test("requestReset: !ok without JSON, with a non-text error, or with an empty error uses the generic message", async () => {
  const { requestReset, GENERIC_ERROR } = await import("../src/app/konto/zapomniane-haslo/requestReset");
  for (const response of [
    () => new Response("<html>502</html>", { status: 502 }),
    () => json({ error: 42 }, 400),
    () => json({ error: "" }, 400),
    () => json(null, 500)
  ]) {
    const { value } = await withFetch(async () => response(), () => requestReset("a@b.pl"));
    assert.deepEqual(value, { ok: false, error: GENERIC_ERROR });
  }
});

test("requestReset: !ok with a text error passes that text on", async () => {
  const { requestReset } = await import("../src/app/konto/zapomniane-haslo/requestReset");
  const { value } = await withFetch(async () => json({ error: "Nieprawidłowy e-mail." }, 400), () => requestReset("zly"));
  assert.deepEqual(value, { ok: false, error: "Nieprawidłowy e-mail." });
});

test("requestReset: ok returns devResetUrl only when it is a non-empty string; a non-JSON ok body is still ok", async () => {
  const { requestReset } = await import("../src/app/konto/zapomniane-haslo/requestReset");
  const url = "http://localhost:3000/konto/reset-hasla?token=abc";
  assert.deepEqual((await withFetch(async () => json({ ok: true, devResetUrl: url }), () => requestReset("a@b.pl"))).value, { ok: true, devResetUrl: url });
  assert.deepEqual((await withFetch(async () => json({ ok: true }), () => requestReset("a@b.pl"))).value, { ok: true, devResetUrl: undefined });
  assert.deepEqual((await withFetch(async () => json({ ok: true, devResetUrl: 5 }), () => requestReset("a@b.pl"))).value, { ok: true, devResetUrl: undefined });
  assert.deepEqual((await withFetch(async () => json({ ok: true, devResetUrl: "" }), () => requestReset("a@b.pl"))).value, { ok: true, devResetUrl: undefined });
  assert.deepEqual((await withFetch(async () => new Response("ok", { status: 200 }), () => requestReset("a@b.pl"))).value, { ok: true, devResetUrl: undefined });
});
