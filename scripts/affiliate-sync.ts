/**
 * Daily affiliate sync, run by the scheduled agent after it read the partner
 * panels (eBrokerPartner, ComperiaLead) in the owner's logged-in browser.
 *
 *   npx tsx scripts/affiliate-sync.ts sync <snapshot.json> [--apply]   one network's reading → tables + changes
 *   npx tsx scripts/affiliate-sync.ts links [--apply]                 point links at the better-paying network
 *   npx tsx scripts/affiliate-sync.ts report [--since <ISO>]          text for the daily e-mail (default: last 24 h)
 *   npx tsx scripts/affiliate-sync.ts zasady [bank]                   what may not be done when promoting (for TikToks, ads)
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
import { NETWORK_RULES, normalizeBank, promoRestrictions } from "../src/lib/affiliateRules";

/** Promoting rules per campaign, straight from the panels' text in the DB, plus each network's general rules. */
async function printRules(db: PrismaClient, bank: string | undefined) {
  const offers = await db.affiliateOffer.findMany({
    where: { missingSince: null },
    orderBy: [{ bankName: "asc" }, { network: "asc" }],
    select: { network: true, externalId: true, name: true, bankName: true, notes: true, conditions: true, ownApplicationsAllowed: true, lastSeenAt: true, promotion: { select: { slug: true } } }
  });
  const wanted = bank ? normalizeBank(bank) : null;
  for (const o of offers) {
    if (wanted && !normalizeBank(o.bankName).includes(wanted)) continue;
    const r = promoRestrictions(`${o.notes ?? ""} ${o.conditions ?? ""}`);
    console.log("");
    console.log(`${o.bankName}: ${o.name} [${o.network} ${o.externalId}]${o.promotion ? ` -> /promocje/${o.promotion.slug}` : ""} (odczyt ${o.lastSeenAt.toISOString().slice(0, 10)})`);
    if (!r.length) console.log("  - brak zakazów w opisie kampanii");
    for (const x of r) console.log(`  - ${x.label}`);
    if (o.ownApplicationsAllowed === false) console.log("  - zakaz wniosków własnych");
    if (o.notes) console.log(`  uwagi z panelu: ${o.notes}`);
  }
  for (const [network, rules] of Object.entries(NETWORK_RULES)) {
    console.log("");
    console.log(`Zasady całej sieci ${network}:`);
    console.log(`  wniosek na siebie: ${rules.own}`);
    for (const x of rules.promo) console.log(`  - ${x}`);
  }
}

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
    } else if (command === "zasady") {
      await printRules(db, rest.find((a) => !a.startsWith("--")));
    } else {
      throw new Error("Polecenia: sync <plik> | links | report | zasady [bank]");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
