/**
 * Local entry points for the eBroker catalog watch (the production job is the
 * /api/cron/ebroker-watch route; both call services/ebrokerWatch.ts).
 *
 *   npx tsx scripts/ebroker-watch.ts run [--file feed.xml]   one watch run (live feed unless --file)
 *   npx tsx scripts/ebroker-watch.ts link                    link known promotions to campaigns (data/ebroker-campaign-map.json)
 *   npx tsx scripts/ebroker-watch.ts pending                 watched campaigns that have no promotion yet (JSON)
 *   npx tsx scripts/ebroker-watch.ts skip                    apply data/ebroker-skip.json: oid -> reason (no own promotion)
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { runEbrokerWatch } from "../src/lib/services/ebrokerWatch";

const LIVE_URL = process.env.EBROKER_CATALOG_URL ?? "https://bankmiplaci.ebrokerpartner.pl/xml-file";

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const db = new PrismaClient();
  try {
    if (cmd === "run") {
      const fileIdx = rest.indexOf("--file");
      const fetchXml =
        fileIdx >= 0
          ? async () => fs.readFileSync(path.resolve(rest[fileIdx + 1] ?? ""), "utf-8")
          : async () => {
              const res = await fetch(LIVE_URL, { signal: AbortSignal.timeout(20_000) });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.text();
            };
      const { result, notifications } = await runEbrokerWatch(db, fetchXml);
      console.log(JSON.stringify(result, null, 2));
      for (const n of notifications) console.log(`• [${n.type}] ${n.title}\n    ${n.body}`);
    } else if (cmd === "link") {
      const map: Record<string, string> = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "data", "ebroker-campaign-map.json"), "utf-8")
      );
      for (const [oid, slug] of Object.entries(map)) {
        if (oid.startsWith("_")) continue;
        const promo = await db.promotion.findUnique({ where: { slug }, select: { id: true } });
        if (!promo) {
          console.log(`brak promocji ${slug} (oid ${oid}) — pomijam`);
          continue;
        }
        const r = await db.ebrokerCampaign.updateMany({ where: { oid }, data: { promotionId: promo.id } });
        console.log(`${oid} → ${slug}${r.count ? "" : " (kampanii nie ma jeszcze w tabeli — uruchom najpierw: run)"}`);
      }
    } else if (cmd === "skip") {
      const skips: Record<string, string> = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "data", "ebroker-skip.json"), "utf-8")
      );
      for (const [oid, reason] of Object.entries(skips)) {
        if (oid.startsWith("_")) continue;
        const r = await db.ebrokerCampaign.updateMany({ where: { oid, promotionId: null }, data: { skipReason: reason } });
        console.log(`${oid}: ${r.count ? "oznaczono" : "pominięto (brak w tabeli albo ma już promocję)"} — ${reason}`);
      }
    } else if (cmd === "pending") {
      const rows = await db.ebrokerCampaign.findMany({
        where: { watched: true, ignored: false, promotionId: null, skipReason: null, missingSince: null },
        orderBy: [{ institution: "asc" }, { oid: "asc" }]
      });
      console.log(JSON.stringify(rows, null, 2));
    } else {
      console.error("Użycie: run [--file feed.xml] | link | skip | pending");
      process.exit(1);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
