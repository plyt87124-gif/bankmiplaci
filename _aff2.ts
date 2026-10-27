import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const line = readFileSync(".env.production.check", "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="))!;
const url = line.split("=", 2)[1]!.trim().replace(/^"|"$/g, "");
if (!url.includes("ep-spring-rice-b2ou0ds9")) throw new Error("not production");
const prod = new PrismaClient({ datasourceUrl: url });
(async () => {
  const all = await prod.promotion.findMany({ select: { slug: true, name: true, status: true, affiliateUrl: true, affiliateLinkEnabled: true, endDate: true, bank: { select: { slug: true } } }, orderBy: [{ status: "asc" }, { slug: "asc" }] });
  const counts: Record<string, number> = {};
  for (const p of all) counts[p.status] = (counts[p.status] ?? 0) + 1;
  console.log("by status:", JSON.stringify(counts));
  for (const p of all) {
    const eb = /^https:\/\/bankmiplaci\.ebrokerpartner\.pl\/(short\/|targetclick\.php\?param=)/.test(p.affiliateUrl);
    if (p.status !== "ACTIVE" || !eb || !p.affiliateLinkEnabled) console.log(`${p.status.padEnd(8)} enabled=${p.affiliateLinkEnabled} ebroker=${eb} end=${p.endDate.toISOString().slice(0, 10)} ${p.slug} -> ${p.affiliateUrl.slice(0, 90)}`);
  }
  const banks = await prod.bank.findMany({ select: { slug: true, name: true, website: true }, orderBy: { slug: "asc" } });
  console.log("\nbanks:", banks.length);
  for (const b of banks) console.log(`${b.slug.padEnd(16)} ${b.website ?? "-"}`);
  process.exit(0);
})();
