// Delikatne rysunki w tle (moneta, banknot, procent, karta, stos monet) z paralaksą przy przewijaniu.
// Testujemy czystą funkcję położenia i znacznik z renderu serwerowego; sam ruch przy przewijaniu
// (requestAnimationFrame + transform) sprawdzamy w przeglądarce.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DECOR_ITEMS, ScrollDecor, decorY } from "../src/components/ScrollDecor";

const html = renderToStaticMarkup(h(ScrollDecor));

test("decorY: na początku strony rysunek stoi tam, gdzie go ustawiono; wolniejszy ucieka wolniej niż strona", () => {
  const item = { y: 50, speed: 0.2, size: 60 };
  assert.equal(Math.round(decorY(item, 0, 800)), 400);
  // Strona przesunęła się o 500 px, rysunek o 100 px: stąd wrażenie, że jest dalej.
  assert.equal(Math.round(decorY(item, 500, 800)), 300);
  // Szybszy od strony (blisko): przesuwa się o więcej niż scroll.
  assert.equal(Math.round(decorY({ y: 50, speed: 1.2, size: 60 }, 100, 800)), 280);
});

test("decorY: zawija się poza ekranem (nigdy nie widać skoku) i zostaje w zakresie", () => {
  for (const item of DECOR_ITEMS) {
    const margin = item.size * 1.5 + 40;
    for (let scroll = 0; scroll < 20000; scroll += 137) {
      const y = decorY(item, scroll, 900);
      assert.ok(y >= -margin && y < 900 + margin, `${item.glyph} @${scroll}: ${y}`);
    }
  }
  // Rysunek, który wychodzi górą, wraca dołem już poza widocznym obszarem.
  const item = { y: 10, speed: 1, size: 60 };
  const before = decorY(item, 80, 800);
  const after = decorY(item, 81 + 200, 800);
  assert.ok(before < 0 || after > 0);
});

test("rysunki: mało, ledwo widoczne, o różnych prędkościach, z przodu i z tyłu", () => {
  assert.equal(DECOR_ITEMS.length, 6);
  assert.ok(DECOR_ITEMS.every((i) => i.opacity <= 0.16 && i.opacity >= 0.1), "przezroczystość 10 do 16 %, ledwo widać");
  assert.ok(DECOR_ITEMS.filter((i) => i.layer === "front").every((i) => i.opacity <= 0.12), "z przodu jeszcze słabiej, bo leżą na treści");
  assert.deepEqual(DECOR_ITEMS.filter((i) => i.layer === "front").map((i) => i.speed > 1), [true, true], "z przodu tylko bliskie, szybsze od strony");
  assert.ok(DECOR_ITEMS.filter((i) => i.layer === "back").every((i) => i.speed < 1), "z tyłu tylko dalekie, wolniejsze od strony");
  assert.ok(DECOR_ITEMS.every((i) => i.size <= 130));
  const speeds = DECOR_ITEMS.map((i) => i.speed);
  assert.ok(Math.min(...speeds) < 0.2 && Math.max(...speeds) > 1, "są i bardzo wolne (daleko), i szybsze od strony (blisko)");
  assert.ok(new Set(speeds).size >= 5, "różne prędkości, nie jeden ruch");
  assert.ok(DECOR_ITEMS.filter((i) => !i.desktopOnly).length === 4, "na telefonie cztery");
});

test("znacznik: dwie warstwy, ukryte przed czytnikami, bez zdarzeń myszy, kolor dla dekoracji, bez tekstu", () => {
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.match(html, /data-scroll-decor="back" class="pointer-events-none fixed inset-0 -z-10/);
  assert.match(html, /data-scroll-decor="front" class="pointer-events-none fixed inset-0 z-30/, "pod nagłówkiem (z-40)");
  assert.equal((html.match(/stroke-ink-300/g) ?? []).length, 6, "kontur w kolorze przeznaczonym na dekoracje (ink-300), nie na tekst");
  assert.doesNotMatch(html, /text-ink-300/);
  assert.equal((html.match(/print:hidden/g) ?? []).length, 2);
  assert.equal((html.match(/data-decor="/g) ?? []).length, 6);
  assert.equal((html.match(/hidden [^"]*md:block/g) ?? []).length, 2, "dwa tylko na szerokim ekranie");
  assert.equal(html.replace(/<[^>]+>/g, "").trim(), "", "same rysunki, żaden tekst");
  assert.doesNotMatch(html, /<img|<image|NBP|WZOR/i, "własne kontury, bez wizerunków prawdziwych banknotów");
  assert.match(html, /stroke-width="1\.5"/);
  assert.match(html, /vector-effect="non-scaling-stroke"/);
});

test("render serwerowy i kliencki dają ten sam znacznik początkowy (pozycja startowa zależy tylko od danych)", () => {
  assert.equal(renderToStaticMarkup(h(ScrollDecor)), html);
  assert.match(html, /opacity:0/, "zaczyna niewidoczny i pojawia się po załadowaniu");
});
