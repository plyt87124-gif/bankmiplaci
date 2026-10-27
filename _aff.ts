import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const line = readFileSync(".env.production.check", "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="))!;
const url = line.split("=", 2)[1]!.trim().replace(/^"|"$/g, "");
if (!url.includes("ep-spring-rice-b2ou0ds9")) throw new Error("not production");
const prod = new PrismaClient({ datasourceUrl: url });
(async () => {
  const promos = await prod.promotion.findMany({
    where: { status: "ACTIVE" },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, name: true, affiliateUrl: true, affiliateLinkEnabled: true, endDate: true, bank: { select: { name: true, slug: true } } }
  });
  const camps = await prod.ebrokerCampaign.findMany({ orderBy: { oid: "asc" } });
  console.log("campaigns in table:", camps.length, "| watched:", camps.filter((c) => c.watched).length, "| linked to a promotion:", camps.filter((c) => c.promotionId).length);
  const byPromo = new Map<string, typeof camps>();
  for (const c of camps) if (c.promotionId) byPromo.set(c.promotionId, [...(byPromo.get(c.promotionId) ?? []), c]);
  for (const p of promos) {
    const linked = byPromo.get(p.id) ?? [];
    console.log(`\n${p.slug}  [${p.bank.slug}] enabled=${p.affiliateLinkEnabled} end=${p.endDate.toISOString().slice(0, 10)}`);
    console.log(`   affiliateUrl: ${p.affiliateUrl}`);
    for (const c of linked) console.log(`   ebroker oid=${c.oid} "${c.name}" tracking=${c.trackingUrl} ${c.trackingUrl === p.affiliateUrl ? "(SAME)" : "(DIFFERENT)"}`);
    if (linked.length === 0) console.log("   ebroker: not linked");
  }
  console.log("\n--- campaigns watched but not linked ---");
  for (const c of camps.filter((c) => c.watched && !c.promotionId)) console.log(`oid=${c.oid} ${c.institution} | ${c.name} | skip=${(c as any).skipReason ?? "-"} | ${c.trackingUrl}`);
  process.exit(0);
})();
