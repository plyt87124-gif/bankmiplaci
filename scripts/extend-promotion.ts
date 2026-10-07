/**
 * Records a VERIFIED extension / new deadline of an existing promotion.
 *
 *   npx tsx scripts/extend-promotion.ts <slug> <YYYY-MM-DD> --evidence <regulamin-url> [--apply] [--notify]
 *
 * Dry-run by default. endDate is the last day a NEW participant can join (kept
 * inclusive everywhere, see src/lib/promotionAvailability.ts). The script only
 * moves the date later, never earlier, and refuses without an evidence URL: the
 * eBroker catalog has no dates, so an extension must come from the bank's own
 * regulamin or offer page. A promotion that was EXPIRED becomes ACTIVE again
 * when the new date is not in the past.
 */
import { PrismaClient } from "@prisma/client";
import { recomputeRatings } from "../src/lib/services/ratings";
import { isDeadlinePassed } from "../src/lib/promotionAvailability";

async function main() {
  const args = process.argv.slice(2);
  const [slug, newEnd] = args.filter((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--evidence");
  const evIdx = args.indexOf("--evidence");
  const evidence = evIdx >= 0 ? args[evIdx + 1] : undefined;
  const apply = args.includes("--apply");
  if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(newEnd ?? "")) throw new Error("Użycie: <slug> <RRRR-MM-DD> --evidence <url> [--apply] [--notify]");
  if (!evidence || !/^https:\/\//.test(evidence)) throw new Error("Wymagany jest --evidence <https://… adres regulaminu lub oferty banku>.");

  const db = new PrismaClient();
  try {
    const p = await db.promotion.findUnique({ where: { slug } });
    if (!p) throw new Error(`Nie ma promocji "${slug}".`);
    const end = new Date(`${newEnd}T00:00:00.000Z`);
    if (end <= p.endDate) throw new Error(`Nowa data ${newEnd} nie jest późniejsza niż obecna ${p.endDate.toISOString().slice(0, 10)}.`);
    const reactivate = p.status === "EXPIRED" && !isDeadlinePassed(end);
    console.log(`${p.name}: koniec ${p.endDate.toISOString().slice(0, 10)} → ${newEnd}${reactivate ? ", status EXPIRED → ACTIVE" : ""}`);
    console.log(`Dowód: ${evidence}`);
    if (!apply) {
      console.log("Dry-run. Nic nie zapisano.");
      return;
    }
    await db.promotion.update({
      where: { id: p.id },
      data: {
        endDate: end,
        lastVerifiedAt: new Date(),
        additionalSourceUrls: p.additionalSourceUrls.includes(evidence) || p.sourceUrl === evidence ? p.additionalSourceUrls : [...p.additionalSourceUrls, evidence],
        ...(reactivate ? { status: "ACTIVE" } : {})
      }
    });
    if (args.includes("--notify")) {
      await db.adminNotification
        .create({
          data: {
            type: "PROMOTION_CHECK_NEEDED",
            title: `Promocja przedłużona (zweryfikowano): ${p.name}`,
            body: `Nowy koniec: ${newEnd}${reactivate ? ", przywrócono status ACTIVE" : ""}. Źródło: ${evidence}`,
            relatedPromotionId: p.id,
            dedupKey: `promo-extended:${p.id}:${newEnd}`
          }
        })
        .catch((e: { code?: string }) => {
          if (e.code !== "P2002") throw e;
        });
    }
    await recomputeRatings();
    console.log("Zapisano.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
