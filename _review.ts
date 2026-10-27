// TEMPORARY (not committed), READ-ONLY: dumps every active open offer of production (what the site says) and the text
// of its source documents, and checks which of the offer's figures/dates appear in the documents.
import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { readFileSync as rf } from "node:fs";
import { mkdtemp as mkdtempP, rm as rmP, writeFile as writeFileP, mkdir as mkdirP } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { htmlToText } from "./src/lib/verificationSources";
import { sourceUrlsOf } from "./src/lib/verification";
import { isDeadlinePassed } from "./src/lib/promotionAvailability";

const OUT = process.argv[2]!;
const line = rf(".env.production.check", "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="))!;
const url = line.split("=", 2)[1]!.trim().replace(/^"|"$/g, "");
if (!url.includes("ep-spring-rice-b2ou0ds9")) throw new Error("not production");
const prod = new PrismaClient({ datasourceUrl: url });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 BankMiPlaciWeryfikacja/1.0 (+https://bankmiplaci.pl/metodologia)";
const pdfToText = (file: string) =>
  new Promise<string>((res, rej) => execFile("pdftotext", ["-enc", "UTF-8", "-nopgbrk", file, "-"], { maxBuffer: 200e6 }, (e, o) => (e ? rej(e) : res(o))));

async function doc(u: string): Promise<{ ok: boolean; text: string; problem?: string }> {
  try {
    const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(45000), headers: { "user-agent": UA, accept: "text/html,application/pdf;q=0.9,*/*;q=0.5", "accept-language": "pl-PL,pl;q=0.9" } });
    if (!r.ok) return { ok: false, text: "", problem: `HTTP ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
      const dir = await mkdtempP(join(tmpdir(), "rev-"));
      try {
        await writeFileP(join(dir, "d.pdf"), buf);
        return { ok: true, text: (await pdfToText(join(dir, "d.pdf"))).replace(/\s+/g, " ") };
      } finally {
        await rmP(dir, { recursive: true, force: true });
      }
    }
    const t = htmlToText(buf.toString("utf8"));
    return t.length < 400 ? { ok: false, text: t, problem: `za mało tekstu (${t.length})` } : { ok: true, text: t };
  } catch (e) {
    return { ok: false, text: "", problem: e instanceof Error ? e.message : String(e) };
  }
}

const zl = (c: number | null | undefined) => (c == null ? "BRAK" : `${c / 100} zł`);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-");
const PL_MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
/** Variants a date may be written in: 31.12.2026, 31.12.26, 31 grudnia 2026, 2026-12-31. */
function dateVariants(iso: string): string[] {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dd = String(d).padStart(2, "0"), mm = String(m).padStart(2, "0");
  return [`${d}.${mm}.${y}`, `${dd}.${mm}.${y}`, `${d}.${m}.${y}`, `${dd}.${mm}.${String(y).slice(2)}`, `${d} ${PL_MONTHS[m - 1]} ${y}`, `${iso}`, `${d} ${PL_MONTHS[m - 1]}`];
}
function amountVariants(cents: number): string[] {
  const z = cents / 100;
  const plain = String(z);
  const spaced = z >= 1000 ? `${Math.floor(z / 1000)} ${String(z % 1000).padStart(3, "0")}` : plain;
  const spaced2 = z >= 1000 ? `${Math.floor(z / 1000)} ${String(z % 1000).padStart(3, "0")}` : plain;
  const tys = z >= 1000 && z % 1000 === 0 ? `${z / 1000} tys` : plain;
  const comma = plain.replace(".", ",");
  return [...new Set([plain, comma, spaced, spaced2, tys, z >= 1000 ? `${Math.floor(z / 1000)}.${String(z % 1000).padStart(3, "0")}` : plain])];
}

(async () => {
  await mkdirP(join(OUT, "offers"), { recursive: true });
  await mkdirP(join(OUT, "docs"), { recursive: true });
  const rows = await prod.promotion.findMany({
    where: { status: "ACTIVE" },
    orderBy: { slug: "asc" },
    include: {
      bank: { select: { name: true } },
      conditions: { orderBy: { order: "asc" } },
      bonusParts: { orderBy: { order: "asc" } },
      fees: true,
      checklistSteps: { orderBy: { order: "asc" } }
    }
  });
  const open = rows.filter((r) => !isDeadlinePassed(r.endDate));
  const summary: string[] = [];
  for (const p of open) {
    const urls = sourceUrlsOf({ sourceUrl: p.sourceUrl, additionalSourceUrls: p.additionalSourceUrls, feesSourceUrl: p.fees?.sourceUrl });
    const docs = await Promise.all(urls.map(doc));
    const all = docs.map((d) => d.text).join(" \n ");
    await Promise.all(docs.map((d, i) => writeFileP(join(OUT, "docs", `${p.slug}-${i + 1}.txt`), `${urls[i]}\n\n${d.text}`)));

    const f = p.fees;
    const lines: string[] = [];
    lines.push(`# ${p.bank.name} - ${p.name} [${p.slug}]`);
    lines.push(`start ${day(p.startDate)}  koniec ${day(p.endDate)}  max ${zl(p.maxBonusCents)}  zweryfikowano ${day(p.lastVerifiedAt)}`);
    lines.push(`źródła: ${urls.map((u, i) => `${docs[i]!.ok ? "OK " : "BŁĄD(" + docs[i]!.problem + ") "}${u}`).join("\n        ")}`);
    lines.push(`dla kogo: ${p.eligibleFor ?? "-"} | nie dla: ${p.notEligibleFor ?? "-"} | karencja ${p.cooldownMonths ?? "-"} mies. od ${day(p.cooldownCutoffDate)}`);
    lines.push("części premii:\n" + (p.bonusParts.map((b) => `  - ${b.label}: ${zl(b.amountCents)}${b.availableUntil ? ` (do ${day(b.availableUntil)})` : ""}`).join("\n") || "  -"));
    lines.push("warunki:\n" + (p.conditions.map((c) => `  - ${c.title}${c.description ? ` - ${c.description}` : ""}`).join("\n") || "  -"));
    lines.push(`opłaty: konto ${zl(f?.accountFeeCents)}${f?.accountFeeWaiverCondition ? ` [${f.accountFeeWaiverCondition}]` : ""}; karta ${zl(f?.cardFeeCents)}${f?.cardFeeWaiverCondition ? ` [${f.cardFeeWaiverCondition}]` : ""}`);
    lines.push("ściąga:\n" + (p.checklistSteps.map((s) => `  ${s.order} ${s.monthLabel} | ${s.title}${s.rewardCents != null ? ` | NAGRODA ${zl(s.rewardCents)}` : ""}`).join("\n") || "  -"));

    // which of the offer's own figures and dates appear in the documents at all
    const missing: string[] = [];
    const check = (label: string, variants: string[]) => {
      if (!variants.some((v) => all.includes(v))) missing.push(label);
    };
    for (const [k, d] of [["koniec", p.endDate], ["start", p.startDate]] as const) check(`${k} ${day(d)}`, dateVariants(day(d)));
    check(`max premia ${zl(p.maxBonusCents)}`, amountVariants(p.maxBonusCents));
    for (const b of p.bonusParts) check(`część "${b.label}" ${zl(b.amountCents)}`, amountVariants(b.amountCents));
    if (f?.accountFeeCents) check(`opłata konto ${zl(f.accountFeeCents)}`, amountVariants(f.accountFeeCents));
    if (f?.cardFeeCents) check(`opłata karta ${zl(f.cardFeeCents)}`, amountVariants(f.cardFeeCents));
    // thresholds quoted in conditions / ściąga / waivers: every number >= 100 (and decimals) must occur in the documents
    const norm = (t: string) => t.replace(/(\d)[\s ](\d{3})(?!\d)/g, "$1$2").replace(/(\d),(\d)/g, "$1.$2");
    const docsNorm = norm(all);
    const ours = norm([...p.conditions.map((c) => `${c.title} ${c.description ?? ""}`), ...p.checklistSteps.map((s) => s.title), f?.accountFeeWaiverCondition ?? "", f?.cardFeeWaiverCondition ?? ""].join(" | "));
    const nums = [...new Set((ours.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => (Number(n) >= 100 && !(Number(n) >= 2020 && Number(n) <= 2030)) || n.includes(".")))];
    const absent = nums.filter((n) => !new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d])`).test(docsNorm));
    if (absent.length) missing.push(`progi z warunków/ściągi bez pokrycia w dokumentach: ${absent.join(", ")}`);
    const flags = /promocja zakończona|zakończyła się|została zakończona|pula (została )?wyczerpana|wyczerpano pulę|nie jest już dostępn|promocja nieaktualna/i.exec(all);
    lines.push(`\nKONTROLA LICZB: ${missing.length ? "NIE ZNALEZIONO w dokumentach: " + missing.join("; ") : "wszystkie daty i kwoty oferty występują w dokumentach"}${docs.some((d) => !d.ok) ? " | NIEODCZYTANE DOKUMENTY" : ""}${flags ? ` | uwaga, słowo w dokumentach: "${flags[0]}"` : ""}`);
    await writeFileP(join(OUT, "offers", `${p.slug}.txt`), lines.join("\n"));
    summary.push(`${p.slug.padEnd(62)} docs ${docs.filter((d) => d.ok).length}/${docs.length}  ${missing.length ? "BRAK: " + missing.join("; ") : "liczby OK"}${flags ? `  [słowo: ${flags[0]}]` : ""}`);
  }
  await writeFileP(join(OUT, "SUMMARY.txt"), summary.join("\n"));
  console.log(summary.join("\n"));
  process.exit(0);
})();
