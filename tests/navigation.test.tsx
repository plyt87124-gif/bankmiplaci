// Navigation (header, mobile menu, footer): one list of links, no dead routes,
// the publisher row identical to the Regulamin. Server-render tests, no browser;
// the interactive behaviour (menu, Esc, focus, scroll border) is checked with
// Playwright against the dev server (see the WP-06 report).
// React must be global before the components are imported (see legal-setup.ts).
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { AuthModalProvider } from "../src/components/AuthModalProvider";
import { Header } from "../src/components/Header";
import { FooterView } from "../src/components/Footer";
import { MobileNav } from "../src/components/MobileNav";
import {
  ACCOUNT_LINK,
  FOOTER_COLUMNS,
  MAIN_NAV,
  getFooterColumns,
  getMainNav,
  navAriaCurrent,
  resolveLinks,
  type NavLink
} from "../src/lib/navigation";
import { PUBLISHER, publisherAddress } from "../src/lib/publisher";
import { SITE_ROUTES, isRouteLive } from "../src/lib/seo/routes";

const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "app");

/** True when `segs` resolve to a page.* file; route groups such as "(lista)" do not count as URL segments. */
function hasPage(dir: string, segs: string[]): boolean {
  if (segs.length === 0 && ["page.tsx", "page.ts", "page.jsx", "page.js"].some((f) => fs.existsSync(path.join(dir, f)))) return true;
  if (!fs.existsSync(dir)) return false;
  if (segs.length > 0 && hasPage(path.join(dir, segs[0]!), segs.slice(1))) return true;
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .some((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && hasPage(path.join(dir, e.name), segs));
}

function pageExists(routePath: string): boolean {
  return hasPage(APP, routePath.split("/").filter(Boolean));
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const allLinks: NavLink[] = [...MAIN_NAV, ...FOOTER_COLUMNS.flatMap((c) => c.links)];

// ---------------------------------------------------------------------------
// The list itself
// ---------------------------------------------------------------------------

test("main navigation: Promocje, Porównaj, Quiz, Poradniki, Jak to działa - in this order", () => {
  assert.deepEqual(
    getMainNav().map((l) => l.label),
    ["Promocje", "Porównaj", "Quiz", "Poradniki", "Jak to działa"]
  );
  assert.deepEqual(
    getMainNav().map((l) => l.href),
    ["/promocje", "/porownaj", "/quiz", "/blog", "/jak-to-dziala"]
  );
});

test("no link carries a query string or a hash, and no duplicate parameter preset is left (the old 'Najłatwiejsze promocje')", () => {
  for (const link of allLinks) {
    assert.match(link.href, /^\/[a-z0-9\-/]*$/, `${link.label}: ${link.href}`);
  }
  assert.ok(!allLinks.some((l) => /najłatwiejsze promocje$/i.test(l.label) && !l.gated), "a preset link must be a gated hub, not a ?difficulty URL");
});

test("every link without a flag points to a page that exists today", () => {
  for (const link of allLinks.filter((l) => !l.gated)) {
    assert.ok(pageExists(link.href), `${link.href} (${link.label}) has no page.tsx in src/app`);
  }
});

test("every gated link has a flag in the route registry (so it is switched on together with the sitemap entry)", () => {
  const registry = new Set(SITE_ROUTES.map((r) => r.path));
  for (const link of allLinks.filter((l) => l.gated)) {
    assert.ok(registry.has(link.href), `${link.href} is gated but missing from SITE_ROUTES`);
  }
});

test("nothing the visitor would see points to a missing page (the default flags)", () => {
  const visible = [...getMainNav(), ...getFooterColumns().flatMap((c) => c.links)];
  assert.ok(visible.length > 0);
  for (const link of visible) assert.ok(pageExists(link.href), `${link.href} is shown but has no page`);
});

test("gated links follow isRouteLive: dropped while the page is not live, shown once it is", () => {
  const gated = allLinks.filter((l) => l.gated);
  assert.ok(gated.length >= 6, "the new trust pages and hubs are gated");

  const none = getFooterColumns(() => false).flatMap((c) => c.links);
  assert.ok(none.every((l) => !l.gated), "nothing gated survives when no route is live");

  const everything = getFooterColumns(() => true).flatMap((c) => c.links);
  for (const link of gated) assert.ok(everything.some((l) => l.href === link.href), `${link.href} should appear when live`);

  // One flag, one link: only the live one appears.
  const onlyBanki = resolveLinks(gated, (p) => p === "/banki");
  assert.deepEqual(onlyBanki.map((l) => l.href), ["/banki"]);

  // Default: the flags of the registry decide.
  const shown = new Set(getFooterColumns().flatMap((c) => c.links).map((l) => l.href));
  for (const link of gated) assert.equal(shown.has(link.href), isRouteLive(link.href), link.href);
});

test("footer: four columns (Narzędzia, Wiedza, Zaufanie, Prawo) and the legal links are never gated", () => {
  assert.deepEqual(
    getFooterColumns().map((c) => c.title),
    ["Narzędzia", "Wiedza", "Zaufanie", "Prawo"]
  );
  const legal = FOOTER_COLUMNS.find((c) => c.title === "Prawo");
  assert.deepEqual(legal?.links.map((l) => l.href), ["/regulamin", "/polityka-prywatnosci", "/cookies"]);
  assert.ok(legal?.links.every((l) => !l.gated));
  const trust = getFooterColumns(() => false).find((c) => c.title === "Zaufanie");
  assert.deepEqual(trust?.links.map((l) => l.href), ["/jak-zarabiamy", "/kontakt"]);
  assert.equal(ACCOUNT_LINK.href, "/konto");
});

test("footer: a link appears once per column", () => {
  for (const column of getFooterColumns(() => true)) {
    const hrefs = column.links.map((l) => l.href);
    assert.equal(new Set(hrefs).size, hrefs.length, column.title);
  }
});

test("navAriaCurrent: page, section, nothing", () => {
  assert.equal(navAriaCurrent("/promocje", "/promocje"), "page");
  assert.equal(navAriaCurrent("/promocje/", "/promocje"), "page");
  assert.equal(navAriaCurrent("/promocje/mbank-konto", "/promocje"), "true");
  assert.equal(navAriaCurrent("/blog/jak-wybrac-konto", "/blog"), "true");
  assert.equal(navAriaCurrent("/porownaj", "/promocje"), undefined);
  assert.equal(navAriaCurrent("/promocje-bez-oplat", "/promocje"), undefined, "a prefix of the name is not the section");
  assert.equal(navAriaCurrent(null, "/promocje"), undefined);
  assert.equal(navAriaCurrent("/", "/promocje"), undefined);
});

// ---------------------------------------------------------------------------
// Publisher: ONE place, identical to the Regulamin and the privacy policy
// ---------------------------------------------------------------------------

test("publisher data equals what the Regulamin and the privacy policy already publish", () => {
  const regulamin = read("src/app/regulamin/page.tsx");
  const privacy = read("src/app/polityka-prywatnosci/page.tsx");
  for (const [name, source] of [
    ["regulamin", regulamin],
    ["polityka prywatności", privacy]
  ] as const) {
    assert.ok(source.includes(PUBLISHER.name), `${name}: ${PUBLISHER.name}`);
    assert.ok(!/NIP|REGON|JDG/.test(source), `${name}: no NIP, REGON or legal form (owner decision)`);
    assert.ok(source.includes(PUBLISHER.email), `${name}: e-mail`);
  }
  assert.ok(regulamin.includes(PUBLISHER.street), "regulamin: street");
  assert.ok(regulamin.includes(`${PUBLISHER.postalCode} ${PUBLISHER.city}`), "regulamin: postcode and city");
  assert.equal(publisherAddress(), "Stawiszyn 7a, 26-800 Białobrzegi");
});

test("only the publisher module holds the company data (no copy in the header or footer)", () => {
  for (const file of ["src/components/Footer.tsx", "src/components/Header.tsx", "src/components/MobileNav.tsx"]) {
    const source = read(file);
    assert.ok(!source.includes("Stawiszyn") && !source.includes("pomoc@bankmiplaci.pl"), file);
  }
});

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

const NOW = new Date("2026-10-09T10:00:00Z");

test("footer: brand line and link columns only - no disclosure paragraph, date line, company data or copyright block", () => {
  const html = renderToStaticMarkup(<FooterView />);
  assert.ok(!/data-disclosure/.test(html), "the bottom disclosure block was removed on purpose");
  assert.ok(!/nie jest bankiem ani oficjalnym/.test(text(html)));
  assert.ok(!/Najnowsza weryfikacja oferty|Wydawca|NIP|REGON|©/.test(text(html)));
  assert.ok(!html.includes("mailto:"));
  assert.ok(!/oficjalnym partnerem/i.test(html + read("src/components/Footer.tsx")), "the old false sentence stays gone");
});

test("footer: links of the registry and no forbidden patterns", () => {
  const html = renderToStaticMarkup(<FooterView />);

  for (const href of ["/promocje", "/porownaj", "/quiz", "/konto", "/blog", "/faq", "/jak-to-dziala", "/jak-zarabiamy", "/kontakt", "/regulamin", "/polityka-prywatnosci", "/cookies"]) {
    assert.ok(html.includes(`href="${href}"`), `footer links to ${href}`);
  }
  // Not-yet-live pages must not be linked.
  for (const route of SITE_ROUTES.filter((r) => !r.live)) {
    assert.ok(!html.includes(`href="${route.path}"`), `${route.path} is not live, so not linked`);
  }
  assert.ok(!/text-ink-300|text-\[1[01]px\]|border-ink-100|break-all/.test(html));
  assert.equal((html.match(/<footer/g) ?? []).length, 1);
  assert.match(html, /<nav aria-label="Stopka"/);
});

// ---------------------------------------------------------------------------
// Header and mobile menu (rendered with the real providers)
// ---------------------------------------------------------------------------

const stubRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {}
};

function renderHeader(user: { id: string; name: string | null } | null, pathname = "/promocje") {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={stubRouter as never}>
      <PathnameContext.Provider value={pathname}>
        <AuthModalProvider user={user}>
          <Header />
        </AuthModalProvider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}

test("header: signed-out visitor sees 'Zaloguj się', no duplicate 'Znajdź promocję' button, no preset link", () => {
  const html = renderHeader(null);
  const visible = text(html);
  assert.match(visible, /Zaloguj się/);
  assert.ok(!html.includes("Moje konto"));
  assert.ok(!visible.includes("Znajdź promocję"));
  assert.ok(!visible.includes("Najłatwiejsze promocje"));
  assert.ok(!html.includes("difficulty="), "no parameter-preset URL in the navigation");
});

test("header: signed-in user comes from the session context ('Moje konto' links to /konto)", () => {
  const html = renderHeader({ id: "u1", name: "Anna" });
  assert.match(html, /<a [^>]*href="\/konto"[^>]*>[^]*?Moje konto/);
  assert.ok(!html.includes("Zaloguj się"));
  assert.ok(!html.includes("Anna"), "no personal data in the header markup");
});

test("header: both navs are labelled, links come from the shared list, the current page is marked", () => {
  const html = renderHeader(null, "/promocje");
  assert.match(html, /<nav aria-label="Menu główne"/);
  assert.match(html, /<nav aria-label="Menu mobilne"/);
  for (const link of getMainNav()) assert.ok(html.includes(`href="${link.href}"`), link.href);
  // Desktop: "Promocje" is the current page; others carry no aria-current.
  const desktop = html.slice(html.indexOf('aria-label="Menu główne"'), html.indexOf("</nav>", html.indexOf('aria-label="Menu główne"')));
  assert.equal((desktop.match(/aria-current/g) ?? []).length, 1);
  assert.match(desktop, /aria-current="page"[^>]*href="\/promocje"|href="\/promocje"[^>]*aria-current="page"/);

  const inOffer = renderHeader(null, "/promocje/mbank-konto");
  assert.match(inOffer, /aria-current="true"[^>]*href="\/promocje"|href="\/promocje"[^>]*aria-current="true"/);

  const home = renderHeader(null, "/");
  assert.match(home, /aria-current="page"[^>]*href="\/"|href="\/"[^>]*aria-current="page"/);
});

test("header: sticky, 44 px targets, two-tone wordmark, scroll border starts transparent, no forbidden patterns", () => {
  const html = renderHeader(null);
  assert.match(html, /<header[^>]*class="[^"]*sticky top-0[^"]*border-transparent/);
  assert.match(html, /data-scrolled="false"/);
  assert.match(html, /<img src="\/logo\/bankmiplaci-light\.png" alt="Bankmiplaci"/);
  assert.ok(!/backdrop-blur/.test(html), "no blur");
  assert.ok(!/text-ink-300|text-\[1[01]px\]|border-ink-100|h-13/.test(html));
});

test("mobile menu: the hamburger controls a panel that is always in the DOM and inert while closed", () => {
  const html = renderToStaticMarkup(
    <MobileNav links={getMainNav()} pathname="/quiz" account="guest" onLogin={() => {}} />
  );
  const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(controls, "aria-controls");
  assert.match(html, /<button[^>]*aria-label="Menu"[^>]*aria-expanded="false"|<button[^>]*aria-expanded="false"[^>]*aria-label="Menu"/);
  assert.match(html, new RegExp(`id="${controls}"[^>]*inert|inert[^>]*id="${controls}"`));
  assert.match(html, /h-11 w-11/, "44 x 44 button");
  assert.match(html, /<nav aria-label="Menu mobilne"/);
  for (const link of getMainNav()) assert.ok(html.includes(`href="${link.href}"`), link.href);
  assert.match(html, /aria-current="page"[^>]*href="\/quiz"|href="\/quiz"[^>]*aria-current="page"/);
  assert.match(text(html), /Zaloguj się/);
  assert.ok(!html.includes("Moje konto"));
});

test("mobile menu: signed-in and still-loading states", () => {
  const signedIn = renderToStaticMarkup(<MobileNav links={getMainNav()} pathname="/" account="user" onLogin={() => {}} />);
  assert.match(signedIn, /href="\/konto"/);
  assert.ok(!signedIn.includes("Zaloguj się"));

  const loading = renderToStaticMarkup(<MobileNav links={getMainNav()} pathname="/" account="loading" onLogin={() => {}} />);
  assert.ok(!loading.includes("Zaloguj się") && !loading.includes("Moje konto"), "no guess while the session is unknown");
});

test("the panel does not use the bare `collapse` class (Tailwind's visibility: collapse would hide it)", () => {
  assert.ok(!/className="[^"]*\bcollapse\b/.test(read("src/components/MobileNav.tsx")));
});

test("motion.css names the grid-rows collapse `.collapse-rows`, never a bare `.collapse` (Tailwind's visibility: collapse)", () => {
  const css = read("src/styles/motion.css");
  assert.match(css, /\.collapse-rows\s*\{/);
  assert.match(css, /\.collapse-rows\[data-open="true"\]/);
  assert.ok(!/(^|[\s,}])\.collapse(?![\w-])/m.test(css), "no bare .collapse selector");
});

test("root layout: Header takes no props (no user object in the RSC payload); Footer is rendered once, without a Suspense fallback copy", () => {
  const layout = read("src/app/layout.tsx");
  assert.ok(!/<Header\s+user/.test(layout));
  assert.match(layout, /<Header\s*\/>/);
  // A Suspense with a FooterView fallback streams BOTH footers into the HTML (two disclosures, two publisher blocks).
  assert.ok(!/Suspense/.test(layout.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")), "no Suspense around the footer");
  assert.ok(!/FooterView/.test(layout));
  assert.equal((layout.match(/<Footer\s*\/>/g) ?? []).length, 1);
  assert.ok(!read("src/components/Header.tsx").includes("HeaderProps"));
});

test("root layout takes the site origin from src/lib/seo, not from process.env", () => {
  const layout = read("src/app/layout.tsx");
  assert.ok(!layout.includes("NEXT_PUBLIC_SITE_URL"));
  assert.ok(!layout.includes("NEXT_PUBLIC_SITE_NAME"));
  assert.match(layout, /from "@\/lib\/seo\/siteUrl"/);
});

test("the footer is one <footer> element: the real Footer renders FooterView once", () => {
  const src = read("src/components/Footer.tsx");
  assert.equal((src.match(/<FooterView/g) ?? []).length, 1, "Footer renders FooterView exactly once");
  assert.equal((renderToStaticMarkup(<FooterView />).match(/<footer/g) ?? []).length, 1);
});
