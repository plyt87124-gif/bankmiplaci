const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run: DATABASE_URL is not a local/test database.");
  process.exit(1);
}

const PORT = 3998;
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "visual-artifacts");
const routes = [
  ["home", "/"],
  ["promotions", "/promocje"],
  ["unknown-fees", "/promocje/ci-nullfees"],
  ["conditional-legacy", "/promocje/ci-conditional-legacy"],
  ["long-content", "/promocje/ci-long-content"],
  ["guide", "/jak-to-dziala"],
  ["article-dated", "/blog/ci-article-updated"],
  ["article-undated", "/blog/ci-article-unknown"]
];
const viewports = [
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 1000 }
];

const report = { commit: process.env.GITHUB_SHA ?? "local", pages: [], menu: null, cta: null };
let server;
let browser;

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${BASE}/jak-to-dziala`);
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("visual test server did not start");
}

async function isolatedPage(context) {
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return route.continue();
    if (url.hostname === "example.test" || url.hostname === "example.com") {
      return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>stub</title>stub" });
    }
    return route.abort("blockedbyclient");
  });
  return { page, consoleErrors, failedRequests };
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(PORT)], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(PORT) }
  });
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    for (const [name, route] of routes) {
      const observed = await isolatedPage(context);
      await observed.page.goto(BASE + route, { waitUntil: "networkidle" });
      const dimensions = await observed.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      const screenshot = `${viewport.name}-${name}.png`;
      await observed.page.screenshot({ path: path.join(OUT, screenshot), fullPage: true });
      const item = { viewport: viewport.name, route, screenshot, ...dimensions, consoleErrors: observed.consoleErrors, failedRequests: observed.failedRequests };
      report.pages.push(item);
      assert.ok(dimensions.scrollWidth <= dimensions.innerWidth, `${viewport.name} ${route}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.innerWidth}`);
      assert.deepEqual(observed.consoleErrors, [], `${viewport.name} ${route}: console errors`);
      assert.deepEqual(observed.failedRequests, [], `${viewport.name} ${route}: failed requests`);

      if (route === "/promocje/ci-nullfees" || route === "/promocje/ci-conditional-legacy") {
        const body = await observed.page.locator("body").innerText();
        assert.match(body, /Nieustalone/, `${route}: unverified fee is explicit`);
        assert.doesNotMatch(body, /Bez opłat za prowadzenie/, `${route}: no unconditional-free badge`);
      }
      if (route === "/promocje/ci-conditional-legacy") {
        await assert.doesNotReject(() => observed.page.getByText(/Znany warunek zwolnienia: wpływ co najmniej 1000 zł miesięcznie/).waitFor());
      }
      if (route === "/blog/ci-article-updated") {
        await assert.doesNotReject(() => observed.page.getByText(/Autor testowy CI.*01\.10\.2026/).waitFor());
      }
      if (route === "/blog/ci-article-unknown") {
        await assert.doesNotReject(() => observed.page.getByText(/Data publikacji nieustalona/).waitFor());
      }
      await observed.page.close();
    }

    if (viewport.width === 360) {
      const observed = await isolatedPage(context);
      await observed.page.goto(BASE, { waitUntil: "networkidle" });
      const button = observed.page.getByRole("button", { name: "Otwórz menu" });
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      await button.click();
      assert.equal(await observed.page.getByRole("button", { name: "Zamknij menu" }).getAttribute("aria-expanded"), "true");
      await observed.page.screenshot({ path: path.join(OUT, "360-menu-open.png"), fullPage: true });
      report.menu = { screenshot: "360-menu-open.png", consoleErrors: observed.consoleErrors, failedRequests: observed.failedRequests };
      assert.deepEqual(observed.consoleErrors, [], "mobile menu: console errors");
      assert.deepEqual(observed.failedRequests, [], "mobile menu: failed requests");
      await observed.page.close();
    }
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const observed = await isolatedPage(context);
  await observed.page.goto(`${BASE}/promocje/ci-open`, { waitUntil: "networkidle" });
  const cta = observed.page.getByRole("link", { name: /Przejdź do promocji/ }).first();
  await cta.click();
  await observed.page.waitForURL("https://example.com/partner");
  report.cta = { target: observed.page.url(), externalNetworkSent: false };
  assert.equal(observed.page.url(), "https://example.com/partner");
  await context.close();

  console.log(`ci-visual: ${report.pages.length} page/viewport checks passed`);
}

main()
  .catch((error) => {
    report.error = error.stack || String(error);
    console.error("ci-visual FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await fs.mkdir(OUT, { recursive: true });
    await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    if (server) server.kill();
  });
