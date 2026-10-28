/**
 * Daily verification of the active offers against the banks' own documents.
 * The rules (what may move the "Zweryfikowano" date and what may not) are in
 * src/lib/verification.ts; this is the command line around them.
 *
 *   npx tsx scripts/verify-offers.ts status
 *   npx tsx scripts/verify-offers.ts show <slug>
 *   npx tsx scripts/verify-offers.ts text <slug> --out <dir>
 *   npx tsx scripts/verify-offers.ts plan [--slug <slug>] [--apply] [--allow-remote]
 *   npx tsx scripts/verify-offers.ts confirm <slug> --note "<what was compared>" [--browser-read <url>]... [--apply] [--allow-remote]
 *   npx tsx scripts/verify-offers.ts flag <slug> --result CHANGED|UNREACHABLE --note "<why>" [--apply] [--allow-remote]
 *
 * show     prints what the site says about one offer (dates, bonus parts, conditions, fees,
 *          eligibility, ściąga steps) and its source documents, to compare with the documents.
 * text     saves the text of each of the offer's documents to <dir>/<slug>-<n>.txt (for reading and
 *          comparing with `show`).
 * plan     reads every document of every active offer (PDF via pdftotext, HTML as visible
 *          text), compares it with the last CONFIRMED check and prints one verdict per offer:
 *            UNCHANGED    nothing differs -> with --apply it is recorded as a confirmed check
 *                         (method SOURCE_UNCHANGED) and lastVerifiedAt moves to now
 *            CHANGED / NO_BASELINE / UNREACHABLE / NO_SOURCES
 *                         NOT confirmed, date untouched: someone has to read the documents
 * confirm  for such an offer, AFTER reading its documents and comparing them with the offer
 *          page (bonus, conditions, dates, fees): records a REVIEW check, stores the documents
 *          as the new baseline and moves lastVerifiedAt. --browser-read <url> attests a
 *          document that the script cannot fetch (blocked / script-rendered) but that was
 *          read in a browser. The note says what was compared and with what.
 * flag     records a non-confirming check (CHANGED / UNREACHABLE) and raises an admin
 *          notification; lastVerifiedAt stays where it is, so the page shows the real age.
 *
 * Dry run unless --apply. A database that is not on localhost needs --allow-remote.
 * Exit code 0 even when offers need attention: the verdicts are the report.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { decideFromSnapshots, hoursSinceVerified, type CheckDecision, type SourceSnapshot } from "../src/lib/verification";
import { failedSnapshot, htmlToText, normalizeText, snapshotFromText } from "../src/lib/verificationSources";
import { offersToVerify, recordVerification, type OfferToVerify } from "../src/lib/services/verification";
import { isoDatePL } from "../src/lib/seo/dates";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 BankMiPlaciWeryfikacja/1.0 (+https://bankmiplaci.pl/metodologia)";
const MAX_BYTES = 40 * 1024 * 1024;
const CONCURRENCY = 4;

/** Text of every document read in this run, by URL (for the `text` command). */
const TEXTS = new Map<string, string>();

function pdfToText(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("pdftotext", ["-enc", "UTF-8", "-nopgbrk", file, "-"], { maxBuffer: 200 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    );
  });
}

async function readDocument(url: string): Promise<SourceSnapshot> {
  let lastProblem = "";
  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/pdf;q=0.9,*/*;q=0.5", "accept-language": "pl-PL,pl;q=0.9" }
      });
      lastStatus = res.status;
      if (!res.ok) {
        lastProblem = `HTTP ${res.status}`;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break; // not going to change on a retry
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) return failedSnapshot(url, res.status, "dokument większy niż 40 MB");
      if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
        const dir = await mkdtemp(join(tmpdir(), "verify-"));
        try {
          const file = join(dir, "doc.pdf");
          await writeFile(file, buf);
          const text = await pdfToText(file);
          TEXTS.set(url, text);
          return snapshotFromText(url, res.status, text);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
      const text = htmlToText(buf.toString("utf8"));
      TEXTS.set(url, text);
      return snapshotFromText(url, res.status, text);
    } catch (e) {
      lastProblem = e instanceof Error ? e.message : String(e);
    }
  }
  return failedSnapshot(url, lastStatus, lastProblem || "nieznany błąd");
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

const flagValue = (args: string[], name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flagValues = (args: string[], name: string) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]!] : []));

function describe(offer: OfferToVerify, d: CheckDecision, now: Date): string {
  const age = hoursSinceVerified(offer.lastVerifiedAt, now);
  const head = `${d.decision.padEnd(11)} ${String(age ?? "?").padStart(4)} h  ${offer.slug}`;
  if (d.decision === "UNREACHABLE") return `${head}\n      nieodczytane: ${d.unreachableUrls.join(" | ")}`;
  if (d.decision === "CHANGED") return `${head}\n      zmienione/nowe względem ostatniego potwierdzenia: ${d.changedUrls.join(" | ")}`;
  return head;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const apply = args.includes("--apply");
  const url = process.env.DATABASE_URL ?? "";
  const remote = url !== "" && !/@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (remote && !args.includes("--allow-remote")) throw new Error("Baza nie jest lokalna - dodaj --allow-remote, jeśli to na pewno ma być ona.");
  const db = new PrismaClient();
  const now = new Date();

  try {
    if (command === "status") {
      for (const o of await offersToVerify(db, now)) {
        console.log(`${String(hoursSinceVerified(o.lastVerifiedAt, now)).padStart(5)} h  ${isoDatePL(o.lastVerifiedAt)}  ${o.baseline ? "baseline" : "bez baseline"}  ${o.slug}`);
      }
      return;
    }

    if (command === "show") {
      const slug = args[1];
      if (!slug) throw new Error("Użycie: show <slug>");
      const p = await db.promotion.findUnique({
        where: { slug },
        include: {
          bank: { select: { name: true } },
          conditions: { orderBy: { order: "asc" } },
          bonusParts: { orderBy: { order: "asc" } },
          fees: true,
          checklistSteps: { orderBy: { order: "asc" } },
          verifications: { orderBy: { checkedAt: "desc" }, take: 3 }
        }
      });
      if (!p) throw new Error(`Brak oferty "${slug}".`);
      const zl = (c: number | null | undefined) => (c == null ? "BRAK" : `${c / 100} zł`);
      const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-");
      console.log(`# ${p.bank.name} - ${p.name}  [${p.status}]`);
      console.log(`start ${day(p.startDate)}  koniec (ostatni dzień zapisów) ${day(p.endDate)}  max premia ${zl(p.maxBonusCents)}  trudność ${p.difficulty}`);
      console.log(`weryfikacja: ${day(p.lastVerifiedAt)}; ostatnie kontrole: ${p.verifications.map((v) => `${day(v.checkedAt)} ${v.result}/${v.method}`).join(", ") || "brak"}`);
      console.log(`źródła: ${[p.sourceUrl, ...p.additionalSourceUrls, p.fees?.sourceUrl].filter(Boolean).join(" | ")}`);
      const lines = (items: string[]) => (items.length ? items.join("\n") : "  (brak)");
      console.log(`dla kogo: ${p.eligibleFor ?? "-"}\nnie dla: ${p.notEligibleFor ?? "-"}\nkarencja: ${p.cooldownMonths ?? "-"} mies., od ${day(p.cooldownCutoffDate)}`);
      console.log(
        "części premii:\n" + lines(p.bonusParts.map((b) => `  - ${b.label}: ${zl(b.amountCents)}${b.availableUntil ? ` (do ${day(b.availableUntil)})` : ""}`))
      );
      console.log("warunki:\n" + lines(p.conditions.map((c) => `  - ${c.title}${c.description ? ` - ${c.description}` : ""}`)));
      const f = p.fees;
      console.log(`opłaty: konto ${zl(f?.accountFeeCents)}${f?.accountFeeWaiverCondition ? ` [zwolnienie: ${f.accountFeeWaiverCondition}]` : ""}; karta ${zl(f?.cardFeeCents)}${f?.cardFeeWaiverCondition ? ` [zwolnienie: ${f.cardFeeWaiverCondition}]` : ""}`);
      console.log(
        "ściąga:\n" +
          lines(p.checklistSteps.map((st) => `  ${String(st.order).padStart(3)} ${st.monthLabel} | ${st.title}${st.rewardCents != null ? ` | NAGRODA ${zl(st.rewardCents)}` : ""}`))
      );
      return;
    }

    if (command === "text") {
      const slug = args[1];
      const out = flagValue(args, "--out");
      if (!slug || !out) throw new Error("Użycie: text <slug> --out <katalog>");
      const offer = (await offersToVerify(db, now)).find((o) => o.slug === slug);
      if (!offer) throw new Error(`Brak aktywnej, otwartej oferty "${slug}".`);
      await mkdir(out, { recursive: true });
      for (const [i, u] of offer.sourceUrls.entries()) {
        const snap = await readDocument(u);
        const file = join(out, `${slug}-${i + 1}.txt`);
        await writeFile(file, `${u}

${TEXTS.get(u) ?? ""}`, "utf8");
        console.log(`${snap.ok ? "OK " : "BŁĄD"} ${file}  ${snap.chars ?? "-"} znaków  ${u}${snap.problem ? `  (${snap.problem})` : ""}`);
      }
      return;
    }

    if (command === "plan") {
      const only = flagValue(args, "--slug");
      const offers = (await offersToVerify(db, now)).filter((o) => !only || o.slug === only);
      const results = await inBatches(offers, CONCURRENCY, async (offer) => {
        const sources = await Promise.all(offer.sourceUrls.map(readDocument));
        return { offer, sources, decision: decideFromSnapshots(sources, offer.baseline) };
      });
      const counts: Record<string, number> = {};
      for (const r of results) {
        counts[r.decision.decision] = (counts[r.decision.decision] ?? 0) + 1;
        console.log(describe(r.offer, r.decision, now));
        if (r.decision.decision === "UNCHANGED" && apply) {
          await recordVerification(db, { promotionId: r.offer.id, result: "CONFIRMED", method: "SOURCE_UNCHANGED", sources: r.sources, now });
        }
      }
      console.log(`\n${JSON.stringify(counts)}  ${apply ? "(UNCHANGED zapisane jako potwierdzone)" : "(dry-run - nic nie zapisano; --apply zapisze UNCHANGED)"}`);
      console.log("Oferty poza UNCHANGED wymagają przeczytania dokumentów: potem `confirm <slug> --note ...` albo `flag <slug> ...`.");
      return;
    }

    if (command === "confirm" || command === "flag") {
      const slug = args[1];
      const note = flagValue(args, "--note");
      if (!slug || slug.startsWith("--")) throw new Error(`Użycie: ${command} <slug> --note "..."`);
      const offer = (await offersToVerify(db, now)).find((o) => o.slug === slug);
      if (!offer) throw new Error(`Brak aktywnej, otwartej oferty "${slug}".`);

      if (command === "flag") {
        const result = flagValue(args, "--result");
        if (result !== "CHANGED" && result !== "UNREACHABLE") throw new Error("--result musi być CHANGED albo UNREACHABLE.");
        if (!note?.trim()) throw new Error("flag wymaga --note.");
        const sources = await Promise.all(offer.sourceUrls.map(readDocument));
        console.log(`${offer.slug}: ${result} - ${note}`);
        if (!apply) return console.log("Dry-run. Nic nie zapisano.");
        await recordVerification(db, { promotionId: offer.id, result, method: "REVIEW", sources, note, now });
        const day = isoDatePL(now) ?? now.toISOString().slice(0, 10);
        await db.adminNotification
          .create({
            data: {
              type: "PROMOTION_CHECK_NEEDED",
              title: `Weryfikacja: ${result === "CHANGED" ? "dokument banku się zmienił" : "nie da się odczytać dokumentu"} - ${offer.name}`,
              body: note.trim(),
              relatedPromotionId: offer.id,
              dedupKey: `verify-flag:${offer.id}:${day}`
            }
          })
          .catch((e: { code?: string }) => {
            if (e.code !== "P2002") throw e;
          });
        return console.log("Zapisano (data weryfikacji bez zmian).");
      }

      if (!note?.trim()) throw new Error('confirm wymaga --note "co porównano z czym".');
      const attested = new Set(flagValues(args, "--browser-read"));
      for (const u of attested) if (!offer.sourceUrls.includes(u)) throw new Error(`--browser-read ${u}: to nie jest źródło tej oferty.`);
      const sources: SourceSnapshot[] = await Promise.all(
        offer.sourceUrls.map(async (u) => (attested.has(u) ? { url: u, ok: true, status: null, sha256: null, chars: null, viaBrowser: true } : readDocument(u)))
      );
      const unread = sources.filter((s) => !s.ok && !s.viaBrowser);
      if (unread.length > 0) {
        throw new Error(`Nie odczytano: ${unread.map((s) => `${s.url} (${s.problem})`).join(" | ")}. Przeczytaj w przeglądarce i dodaj --browser-read <url>.`);
      }
      console.log(`${offer.slug}: REVIEW CONFIRMED, dokumenty: ${sources.length} (${sources.filter((s) => s.viaBrowser).length} z przeglądarki)\n  ${normalizeText(note)}`);
      if (!apply) return console.log("Dry-run. Nic nie zapisano.");
      await recordVerification(db, { promotionId: offer.id, result: "CONFIRMED", method: "REVIEW", sources, note, now });
      return console.log("Zapisano; lastVerifiedAt = teraz.");
    }

    throw new Error("Użycie: status | show <slug> | text <slug> --out <katalog> | plan | confirm <slug> | flag <slug> (opis w nagłówku pliku)");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
