import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
const line = readFileSync(".env.production.check", "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="))!;
const url = line.split("=", 2)[1]!.trim().replace(/^"|"$/g, "");
if (!url.includes("ep-spring-rice-b2ou0ds9")) throw new Error("not production");
const prod = new PrismaClient({ datasourceUrl: url });
const PAIRS: Record<string, number> = {
  "alior-konto-18-25-mlodzi-zyskuja": 13780,
  "alior-plusy-karty-z-plusem-ikonto-biznes": 13039,
  "creditagricole-kapitalna-premia": 12831,
  "erste-platinum-1500-plus-300-zl": 13860,
  "mbank-cala-naprzod-edycja-2-bony-biedronka": 13870,
  "mbank-konto-firmowe-mbiznes-bonus-edycja-7": 13868,
  "millennium-do-700-zl-na-twoje-przyjemnosci": 13498,
  "nest-zyskaj-do-3000-zl-wymiana-saldo-eur": 12341,
  "pko-rozkrec-firme-premia-do-5-tys-zl": 13005,
  "revolut-darmowy-okres-probny-i-nagroda": 12347
};
(async () => {
  const out: string[] = [];
  for (const [slug, oid] of Object.entries(PAIRS)) {
    const p = await prod.promotion.findUnique({ where: { slug }, select: { affiliateUrl: true } });
    const c = await prod.ebrokerCampaign.findUnique({ where: { oid: String(oid) } as any });
    out.push(`${slug}\t${p?.affiliateUrl}\t${(c as any)?.trackingUrl}\t${(c as any)?.name}`);
  }
  writeFileSync("C:/Users/plyt8/AppData/Local/Temp/claude/C--Users-plyt8-Desktop-bank-promo-comparator/df998565-c365-44ed-bad2-d2317519bd7e/scratchpad/pairs.tsv", out.join("\n"));
  console.log(out.length, "pairs");
  process.exit(0);
})();
