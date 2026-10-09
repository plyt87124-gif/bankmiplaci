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
