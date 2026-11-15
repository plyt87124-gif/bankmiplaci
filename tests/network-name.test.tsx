// Właściciel (15.11.2026): nazwy sieci afiliacyjnych na stronie mają wyglądać tak, jak ich logo:
// eBroker partner (granat + niebieski) i comperia Lead (szary szeryfowy napis + jasnoniebieskie „Lead”).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NetworkName } from "../src/components/ui/NetworkName";

(globalThis as unknown as { React: typeof React }).React = React;

const SRC = path.join(process.cwd(), "src");
const CSS = fs.readFileSync(path.join(SRC, "app", "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const render = (network: "EBROKER" | "COMPERIA", variant?: "inline" | "logo") => renderToStaticMarkup(React.createElement(NetworkName, { network, variant }));
const text = (html: string) => html.replace(/<[^>]+>/g, "");

test("eBroker: dwie części (nazwa i „partner”), czysty tekst do skopiowania", () => {
  const html = render("EBROKER");
  assert.match(html, /data-network="EBROKER"/);
  assert.match(html, /<span class="net-main">eBroker<\/span> <span class="net-sub">partner<\/span>/);
  assert.equal(text(html), "eBroker partner");
});

test("Comperia: „Comperia” (na ekranie małymi literami, szeryfowo) i „Lead”", () => {
  const html = render("COMPERIA");
  assert.match(html, /data-network="COMPERIA"/);
  assert.match(html, /<span class="net-main">Comperia<\/span><span class="net-sub">Lead<\/span>/);
  assert.equal(text(html), "ComperiaLead");
  assert.match(CSS, /\.net-comperia \.net-main \{[^}]*text-transform: lowercase/);
  assert.match(CSS, /\.net-comperia \.net-main \{[^}]*font-family: Georgia/);
  assert.match(CSS, /\.net-comperia \.net-sub \{[^}]*font-weight: 300/);
});

test("wariant logo: eBroker w dwóch wierszach, Comperia z podpisem „Program partnerski nr1” ukrytym przed czytnikami", () => {
  const e = render("EBROKER", "logo");
  assert.match(e, /net-logo/);
  assert.match(e, /<br\/>/);
  const c = render("COMPERIA", "logo");
  assert.match(c, /<span class="net-tag" aria-hidden="true">Program <strong>partnerski<\/strong> nr1<\/span>/);
  assert.doesNotMatch(render("COMPERIA"), /net-tag/, "w tekście ciągłym bez podpisu");
});

test("kolory logo: granat i niebieski eBroker, szary i błękitny Comperia; w ciemnym motywie granat jaśnieje", () => {
  assert.match(CSS, /--net-ebroker-main: 0 24 56;/);
  assert.match(CSS, /--net-ebroker-sub: 8 104 224;/);
  assert.match(CSS, /--net-comperia-main: 126 126 126;/);
  assert.match(CSS, /--net-comperia-sub: 66 192 240;/);
  const dark = /\.dark \.net-name \{([^}]*)\}/.exec(CSS)?.[1] ?? "";
  assert.match(dark, /--net-ebroker-main: 226 236 252;/, "granat zniknąłby na ciemnym tle");
});

test("na stronie prowizji nazwy sieci idą przez NetworkName, nie jako goły tekst z NETWORK_LABEL", () => {
  const page = fs.readFileSync(path.join(SRC, "app", "admin", "(dashboard)", "prowizje", "page.tsx"), "utf8");
  assert.doesNotMatch(page, /NETWORK_LABEL/);
  assert.ok((page.match(/<NetworkName /g) ?? []).length >= 10);
});
