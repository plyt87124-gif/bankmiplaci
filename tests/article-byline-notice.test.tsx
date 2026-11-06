import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BankHubLink } from "../src/components/blog/BankHubLink";
import { EndedOfferNotice, endedLinkedOffer } from "../src/components/blog/EndedOfferNotice";
import { articleByline, editorialName } from "../src/lib/editorial";
import { articleLd } from "../src/lib/seo/jsonld";

(globalThis as { React?: typeof React }).React = React;

process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";
delete process.env.NEXT_PUBLIC_SITE_NAME;

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const NOW = new Date("2026-11-05T12:00:00Z");

/* ---------------- byline ---------------- */

test("a generic admin account is the editorial team, never a made-up person", () => {
  for (const name of ["Administrator", "admin", "  ADMINISTRATOR ", "", null, undefined, "Redakcja", "Redakcja Bankmiplaci"]) {
    assert.deepEqual(articleByline(name), { name: editorialName(), kind: "organization" }, String(name));
  }
  assert.equal(editorialName(), "Redakcja Bankmiplaci");
});

test("a real name on the account is shown as a person", () => {
  assert.deepEqual(articleByline("  Anna   Nowak "), { name: "Anna Nowak", kind: "person" });
});

test("articleLd: the editorial team is an Organization author; the default stays a Person", () => {
  const org = articleLd({
    slug: "a",
    title: "T",
    authorName: editorialName(),
    authorType: "Organization",
    authorUrl: "/o-nas"
  }) as Record<string, any>;
  assert.deepEqual(org.author, {
    "@type": "Organization",
    name: "Redakcja Bankmiplaci",
    url: "https://bankmiplaci.example/o-nas"
  });
  const person = articleLd({ slug: "a", title: "T", authorName: "Anna Nowak" }) as Record<string, any>;
  assert.equal(person.author["@type"], "Person");
});

/* ---------------- ended-offer notice ---------------- */

test("endedLinkedOffer: only an offer whose last day has passed counts", () => {
  const ended = { slug: "alior", name: "Konto z Premią", endDate: new Date("2026-10-13T00:00:00Z") };
  const open = { slug: "mbank", name: "eKonto", endDate: new Date("2026-11-30T00:00:00Z") };
  assert.equal(endedLinkedOffer(ended, NOW), ended);
  assert.equal(endedLinkedOffer(open, NOW), null);
  assert.equal(endedLinkedOffer(null, NOW), null);
  assert.equal(endedLinkedOffer(undefined, NOW), null);
});

test("endedLinkedOffer: the last day itself is still open", () => {
  const lastDay = { slug: "x", name: "X", endDate: new Date("2026-11-05T00:00:00Z") };
  assert.equal(endedLinkedOffer(lastDay, NOW), null);
  assert.ok(endedLinkedOffer(lastDay, new Date("2026-11-06T12:00:00Z")));
});

test("EndedOfferNotice says the offer ended, with the date, and links to the current offers", () => {
  const out = html(<EndedOfferNotice offer={{ slug: "alior", name: "Konto z Premią", endDate: new Date("2026-10-13T00:00:00Z") }} />);
  assert.match(out, /Ta promocja zakończyła się 13\.10\.2026/);
  assert.match(out, /Konto z Premią/);
  assert.match(out, /href="\/promocje"/);
  assert.match(out, /data-notice="oferta-zakonczona"/);
  assert.match(out, /role="note"/);
});

/* ---------------- bank hub link ---------------- */

test("BankHubLink points to the bank's own page, named after the bank", () => {
  const out = html(<BankHubLink bank={{ slug: "alior", name: "Alior Bank" }} className="mt-3" />);
  assert.match(out, /href="\/banki\/alior"/);
  assert.match(out, /Wszystkie promocje: Alior Bank/);
  assert.match(out, /class="mt-3"/);
});
