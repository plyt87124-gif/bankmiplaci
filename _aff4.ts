import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const line = readFileSync(".env.production.check", "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="))!;
const url = line.split("=", 2)[1]!.trim().replace(/^"|"$/g, "");
if (!url.includes("ep-spring-rice-b2ou0ds9")) throw new Error("not production");
const prod = new PrismaClient({ datasourceUrl: url });
(async () => {
  const promos = await prod.promotion.findMany({ select: { slug: true, status: true, endDate: true } });
  const st = new Map(promos.map((p) => [p.slug, p]));
  const arts = await prod.article.findMany({ select: { slug: true, title: true, published: true, promotionId: true, body: true } });
  console.log("articles:", arts.length);
  for (const a of arts as any[]) {
    const links = [...String(a.body).matchAll(/\]\(([^)\s]+)[^)]*\)|href="([^"]+)"/g)].map((m) => m[1] ?? m[2]!);
    const outs = links.filter((l) => /\/out\//.test(l));
    const ext = links.filter((l) => /^https?:\/\//.test(l) && !/bankmiplaci\.pl/.test(l));
    const bad: string[] = [];
    for (const o of outs) {
      const slug = o.replace(/^.*\/out\//, "").replace(/[?#].*$/, "");
      const p = st.get(slug);
      if (!p) bad.push(`${slug}: BRAK TAKIEJ OFERTY`);
      else if (p.status !== "ACTIVE") bad.push(`${slug}: ${p.status}`);
    }
    console.log(`${String(a.published).padEnd(6)} ${a.slug.padEnd(55)} out=${outs.length} ext=${ext.length} ${bad.length ? "PROBLEM: " + bad.join("; ") : ""}`);
    for (const e of ext.slice(0, 3)) console.log(`      ext: ${e.slice(0, 110)}`);
  }
  process.exit(0);
})();
