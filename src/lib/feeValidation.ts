type WaiverFees = {
  accountFeeCents?: number | null;
  accountFeeWaiverCondition?: string | null;
  cardFeeCents?: number | null;
  cardFeeWaiverCondition?: string | null;
};

/** Longest waiver condition: the FAQ and the JSON-LD quote at most this much of it (feeModel.ts, FEE_SENTENCE_CONDITION_MAX). */
export const FEE_WAIVER_CONDITION_MAX = 200;
/** "0 zł", "0 zł," or "0 PLN" at the start of a condition. */
const STARTS_WITH_ZERO = /^\s*0\s*(?:z[łl]|pln)/i;

/**
 * The amount is the rate WITHOUT the waiver, so 0 + a waiver is contradictory. The condition itself is only the
 * clause the page appends to "0 zł gdy …", so it must not repeat the "0 zł" (the page would print "0 zł gdy 0 zł, gdy …",
 * owner 2026-11-15, BNP business) and must stay short enough to be quoted whole.
 */
export function feeWaiverProblems(fees: WaiverFees) {
  const pairs = [
    ["accountFeeCents", "accountFeeWaiverCondition"],
    ["cardFeeCents", "cardFeeWaiverCondition"]
  ] as const;
  const problems: { field: string; message: string }[] = pairs
    .filter(([amount, condition]) => fees[amount] === 0 && fees[condition]?.trim())
    .map(([amount]) => ({
      field: amount,
      message: "Podaj opłatę bez spełnienia warunku zwolnienia; jeśli jej nie znasz, pozostaw kwotę nieustaloną."
    }));
  for (const [, condition] of pairs) {
    const text = fees[condition]?.trim();
    if (!text) continue;
    if (STARTS_WITH_ZERO.test(text)) {
      problems.push({
        field: condition,
        message: "Strona sama pisze „0 zł gdy …”, więc warunek nie zaczyna się od „0 zł”. Napisz np. „w poprzednim miesiącu transakcje kartą za min. 700 zł”."
      });
    }
    if (text.length > FEE_WAIVER_CONDITION_MAX) {
      problems.push({ field: condition, message: `Warunek zwolnienia jest dłuższy niż ${FEE_WAIVER_CONDITION_MAX} znaków. Skróć go do jednego zdania.` });
    }
  }
  return problems;
}
