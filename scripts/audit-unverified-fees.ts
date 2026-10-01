/**
 * Read-only report, never writes anything. Two kinds of promotions need a
 * human to look at their Fees row:
 *
 *  1. Genuinely unverified — no Fees row at all, or accountFeeCents/
 *     cardFeeCents left null. These are honest: nothing claims an amount
 *     that hasn't been checked (see Fees in prisma/schema.prisma).
 *
 *  2. Suspect zeros — accountFeeCents or cardFeeCents is exactly 0 but
 *     there's no fees.sourceUrl AND no otherFee/waiver-condition text
 *     backing it up. Before the fees_nullable_and_waiver_conditions
 *     migration, 0 was the column default, so some of these zeros may be
 *     "nobody ever filled this in" rather than "confirmed free" — this
 *     migration intentionally left existing data untouched (see its
 *     migration.sql), so it can't tell the two apart on its own. This
 *     report exists so an admin can, promotion by promotion, without the
 *     migration silently reinterpreting anyone's data either way.
 *
 *   npm run audit:fees
 */
import { db } from "../src/lib/db";

async function main() {
  const promotions = await db.promotion.findMany({
    select: { slug: true, name: true, status: true, fees: true },
    orderBy: { slug: "asc" }
  });

  const unverified = promotions.filter(
    (p) => !p.fees || p.fees.accountFeeCents == null || p.fees.cardFeeCents == null
  );

  const suspectZero = promotions.filter((p) => {
    if (!p.fees) return false;
    const zeroAccount = p.fees.accountFeeCents === 0 && !p.fees.accountFeeWaiverCondition;
    const zeroCard = p.fees.cardFeeCents === 0 && !p.fees.cardFeeWaiverCondition;
    const hasBacking = Boolean(p.fees.sourceUrl || p.fees.otherFee);
    return (zeroAccount || zeroCard) && !hasBacking;
  });

  console.log(`\n=== Nieustalone opłaty (${unverified.length}) ===`);
  console.log("Brak rekordu Fees, lub accountFeeCents/cardFeeCents puste — strona już pokazuje „Nieustalone”.");
  for (const p of unverified) {
    console.log(
      `- [${p.status}] ${p.slug} — konto: ${p.fees?.accountFeeCents ?? "brak"}, karta: ${p.fees?.cardFeeCents ?? "brak"}`
    );
  }

  console.log(`\n=== Podejrzane zera bez źródła (${suspectZero.length}) ===`);
  console.log(
    "accountFeeCents/cardFeeCents = 0, ale brak fees.sourceUrl i otherFee — może to sprzed migracji " +
      "(domyślne 0, nigdy nie zweryfikowane), a nie faktycznie potwierdzone 0 zł. Sprawdź taryfę banku przed zaufaniem."
  );
  for (const p of suspectZero) {
    console.log(`- [${p.status}] ${p.slug} — konto: ${p.fees?.accountFeeCents}, karta: ${p.fees?.cardFeeCents}`);
  }

  if (unverified.length === 0 && suspectZero.length === 0) {
    console.log("\nBrak rekordów wymagających kontroli.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
