/**
 * Daily affiliate sync, run by the scheduled agent after it read the partner
 * panels (eBrokerPartner, ComperiaLead) in the owner's logged-in browser.
 *
 *   npx tsx scripts/affiliate-sync.ts sync <snapshot.json> [--apply]   one network's reading → tables + changes
 *   npx tsx scripts/affiliate-sync.ts links [--apply]                 point links at the better-paying network
 *   npx tsx scripts/affiliate-sync.ts report [--since <ISO>]          text for the daily e-mail (default: last 24 h)
 *
 * Dry-run by default (prints the changes, writes nothing). Snapshot format:
 * SnapshotSchema in src/lib/services/affiliateSync.ts, example in
 * docs/affiliate-snapshot.example.json. Amounts in grosze, dates RRRR-MM-DD,
 * no visitor IPs or personal data in applications.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { chooseLinks, syncSnapshot, type ChangeDraft } from "../src/lib/services/affiliateSync";
import { buildAffiliateReport } from "../src/lib/services/affiliateReport";

function print(changes: ChangeDraft[], apply: boolean) {
  for (const c of changes) console.log(`[${c.kind}] ${c.title}`);
  console.log(`${changes.length} zmian. ${apply ? "Zapisano." : "Dry-run, nic nie zapisano."}`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const apply = rest.includes("--apply");
  const db = new PrismaClient();
  try {
    if (command === "sync") {
      const file = rest.find((a) => !a.startsWith("--"));
      if (!file) throw new Error("Użycie: sync <snapshot.json> [--apply]");
      const raw = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
      print(await syncSnapshot(db, raw, { apply }), apply);
    } else if (command === "links") {
      print(await chooseLinks(db, { apply }), apply);
    } else if (command === "report") {
      const i = rest.indexOf("--since");
      const since = i >= 0 ? new Date(rest[i + 1] ?? "") : new Date(Date.now() - 24 * 3_600_000);
      if (Number.isNaN(since.getTime())) throw new Error("--since: niepoprawna data");
      console.log(await buildAffiliateReport(db, since));
    } else {
      throw new Error("Polecenia: sync <plik> | links | report");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
