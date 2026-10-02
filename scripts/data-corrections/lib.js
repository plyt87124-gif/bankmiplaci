/**
 * Shared machinery for the hand-reviewed production data corrections in this
 * folder. Nothing here runs by itself and nothing is applied unless a script
 * is started with --apply. Properties every correction gets:
 *
 *  - Identified by slug / row id, never by pattern.
 *  - Dry run by default: prints each field "before -> after" and writes nothing.
 *  - One transaction: all changes commit together or none do.
 *  - Compare-and-set: every UPDATE is guarded by `WHERE <col> IS NOT DISTINCT
 *    FROM <value seen in the dry run>`. If anybody (admin, import, cron) changed
 *    that column in the meantime, 0 rows match, the transaction rolls back and
 *    nothing is overwritten. recomputeRatings() only ever touches `rating`, so it
 *    cannot trip this; `updatedAt` is deliberately not part of the guard.
 *  - Revertible: --apply first writes revert-<name>-<time>.json with the exact
 *    previous values; `--revert <file>` restores them, again with a guard (the
 *    row must still hold what this correction wrote) unless --force.
 *  - Refuses to --apply when a column it needs is not in the database yet
 *    (the schema migrations must be deployed first, see docs/etap1-deployment.md).
 *
 * Reads DATABASE_URL from .env.production.check (vercel env pull ...), the same
 * way the earlier handoff scripts did.
 */
const fs = require("fs");

function loadDb() {
  const envText = fs.readFileSync(".env.production.check", "utf8");
  const m = envText.match(/DATABASE_URL="([^"]+)"/);
  if (!m) throw new Error("DATABASE_URL not found in .env.production.check");
  process.env.DATABASE_URL = m[1];
  const { PrismaClient } = require("@prisma/client");
  return new PrismaClient();
}

async function existingColumns(db, tables) {
  const rows = await db.$queryRawUnsafe(
    `select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1::text[])`,
    tables
  );
  return new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
}

// Dates survive the backup file as {"$date": iso} and come back as Date
// objects, because Prisma raw queries would otherwise send them as text and
// Postgres refuses to assign text to a timestamp column.
function dateReplacer(key, value) {
  const original = this[key];
  return original instanceof Date ? { $date: original.toISOString() } : value;
}
function dateReviver(_key, value) {
  return value && typeof value === "object" && typeof value.$date === "string" ? new Date(value.$date) : value;
}

// Bind a value as a query parameter. Dates are sent as ISO text and cast with
// ::text::timestamp: the columns are `timestamp(3)` (no zone, UTC wall time),
// and a JS Date parameter would be typed timestamptz, which Postgres converts
// using the SESSION time zone before comparing - wrong unless that happens to
// be UTC. Parsing the ISO text as a plain timestamp is zone-independent.
function bind(params, value) {
  if (value instanceof Date) {
    params.push(value.toISOString());
    return `$${params.length}::text::timestamp`;
  }
  params.push(value);
  return `$${params.length}`;
}

const fmt = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v === null || v === undefined) return "NULL";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return JSON.stringify(s.length > 220 ? s.slice(0, 217) + "..." : s);
};

/**
 * change = {
 *   table, id, label,
 *   set:    { col: newValue }          // content columns, compare-and-set
 *   expect: { col: valueSeenInDryRun } // must cover every key of `set`
 *   stamp:  ["contentUpdatedAt"]       // bookkeeping columns set to now() (no guard)
 *   oldStamp: { contentUpdatedAt: v }  // their current values, for revert
 *   touchUpdatedAt: true               // also set "updatedAt" = now()
 *   requires: ["table.col", ...]       // columns that must exist for --apply
 *   source: "where the new value comes from"
 * }
 */
function printPlan(name, changes, columns) {
  console.log(`\n=== ${name}: ${changes.length} row change(s) ===`);
  for (const c of changes) {
    const missing = (c.requires ?? []).filter((r) => !columns.has(r));
    console.log(`\n[${c.table} ${c.id}] ${c.label}${missing.length ? `   (needs column: ${missing.join(", ")})` : ""}`);
    if (c.source) console.log(`  source: ${c.source}`);
    for (const k of Object.keys(c.set)) {
      console.log(`  ${k}:\n    before: ${fmt(c.expect[k])}\n    after:  ${fmt(c.set[k])}`);
    }
    if (c.stamp?.length) console.log(`  also stamped with now(): ${c.stamp.join(", ")}${c.touchUpdatedAt ? ', "updatedAt"' : ""}`);
  }
}

async function applyChanges(db, name, changes, columns) {
  const missing = new Set();
  for (const c of changes) for (const r of c.requires ?? []) if (!columns.has(r)) missing.add(r);
  if (missing.size) {
    throw new Error(
      `Refusing to --apply: these columns do not exist in the database yet: ${[...missing].join(", ")}. ` +
        `Deploy the schema migrations first (see docs/etap1-deployment.md).`
    );
  }

  const backup = {
    name,
    createdAt: new Date().toISOString(),
    changes: changes.map((c) => ({
      table: c.table,
      id: c.id,
      label: c.label,
      // what to put back
      restore: { ...Object.fromEntries(Object.keys(c.set).map((k) => [k, c.expect[k]])), ...(c.oldStamp ?? {}) },
      // what the row must still hold for the revert to be safe
      expectNow: c.set,
      stamp: c.stamp ?? [],
      touchUpdatedAt: Boolean(c.touchUpdatedAt)
    }))
  };
  const file = `revert-${name}-${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify(backup, dateReplacer, 2));
  console.log(`\nBackup of previous values written to ${file} (keep it to revert).`);

  await db.$transaction(
    async (tx) => {
      for (const c of changes) await casUpdate(tx, c);
    },
    { timeout: 60_000 }
  );
  console.log("Applied in one transaction.");
}

async function casUpdate(tx, c) {
  const params = [];
  const setParts = [];
  for (const k of Object.keys(c.set)) {
    setParts.push(`"${k}" = ${bind(params, c.set[k])}`);
  }
  for (const k of c.stamp ?? []) setParts.push(`"${k}" = now()`);
  if (c.touchUpdatedAt) setParts.push(`"updatedAt" = now()`);
  const whereParts = [];
  for (const k of Object.keys(c.set)) {
    whereParts.push(`"${k}" IS NOT DISTINCT FROM ${bind(params, c.expect[k])}`);
  }
  params.push(c.id);
  const sql = `UPDATE "${c.table}" SET ${setParts.join(", ")} WHERE id = $${params.length} AND ${whereParts.join(" AND ")}`;
  const n = await tx.$executeRawUnsafe(sql, ...params);
  if (n !== 1) {
    throw new Error(
      `Compare-and-set failed for ${c.table} ${c.id} (${c.label}): the row changed since the dry run, or no longer exists. ` +
        `The whole transaction was rolled back; nothing was written. Re-run the dry run and re-review.`
    );
  }
}

async function revertFrom(db, file, force) {
  const backup = JSON.parse(fs.readFileSync(file, "utf8"), dateReviver);
  await db.$transaction(
    async (tx) => {
      for (const c of backup.changes) {
        const params = [];
        const setParts = [];
        for (const [k, v] of Object.entries(c.restore)) {
          setParts.push(`"${k}" = ${bind(params, v)}`);
        }
        if (c.touchUpdatedAt) setParts.push(`"updatedAt" = now()`);
        const whereParts = [];
        if (!force) {
          for (const k of Object.keys(c.expectNow)) {
            if (c.stamp.includes(k)) continue;
            whereParts.push(`"${k}" IS NOT DISTINCT FROM ${bind(params, c.expectNow[k])}`);
          }
        }
        params.push(c.id);
        const sql = `UPDATE "${c.table}" SET ${setParts.join(", ")} WHERE id = $${params.length}${whereParts.length ? " AND " + whereParts.join(" AND ") : ""}`;
        const n = await tx.$executeRawUnsafe(sql, ...params);
        if (n !== 1) {
          throw new Error(
            `Revert refused for ${c.table} ${c.id} (${c.label}): the row no longer holds what this correction wrote ` +
              `(someone edited it since). Nothing was reverted. Use --force only after checking.`
          );
        }
      }
    },
    { timeout: 60_000 }
  );
  console.log(`Reverted from ${file}.`);
}

module.exports = { loadDb, existingColumns, printPlan, applyChanges, revertFrom, fmt };
