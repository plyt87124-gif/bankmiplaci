/**
 * LOCAL WINDOWS BUILDS ONLY — not used on Vercel (Linux), not part of the app.
 *
 * `next build` fails on Windows at "/opengraph-image" with
 *   TypeError: Invalid URL  (node:internal/url fileURLToPath)
 * because Next 14.2.15's bundled @vercel/og does
 *   fileURLToPath(join(import.meta.url, "../noto-sans-v27-latin-regular.ttf"))
 * and on Windows `path.join` rewrites the file: URL into ".\file:\C:\..."
 * (POSIX join keeps it as a valid URL, so Linux/Vercel builds are fine —
 * the live /opengraph-image is served with 200 image/png).
 *
 * This preload makes `join` treat a "file:" first argument the POSIX way so
 * a full production build can be verified on a Windows machine:
 *
 *   npm run build:win  (-> node scripts/build-win.cjs)
 */
const path = require("path");
const nodeModule = require("module");
const originalJoin = path.join;
path.join = (...args) =>
  typeof args[0] === "string" && args[0].startsWith("file:") ? path.posix.join(...args) : originalJoin(...args);
nodeModule.syncBuiltinESMExports();
