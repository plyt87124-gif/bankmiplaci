// Local Windows production build: preloads the @vercel/og path.join shim
// into next build and its worker processes. See windows-og-build-shim.cjs.
const { spawnSync } = require("child_process");
const path = require("path");
const shim = path.join(__dirname, "windows-og-build-shim.cjs");
const res = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${shim}`.trim() }
});
process.exit(res.status ?? 1);
