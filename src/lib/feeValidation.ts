type WaiverFees = {
  accountFeeCents?: number | null;
  accountFeeWaiverCondition?: string | null;
  cardFeeCents?: number | null;
  cardFeeWaiverCondition?: string | null;
};

/** The amount is the rate WITHOUT the waiver, so 0 + a waiver is contradictory. */
export function feeWaiverProblems(fees: WaiverFees) {
  const pairs = [
    ["accountFeeCents", "accountFeeWaiverCondition"],
    ["cardFeeCents", "cardFeeWaiverCondition"]
  ] as const;
  return pairs.filter(([amount, condition]) => fees[amount] === 0 && fees[condition]?.trim()).map(([amount]) => ({
    field: amount,
    message: "Podaj opłatę bez spełnienia warunku zwolnienia; jeśli jej nie znasz, pozostaw kwotę nieustaloną."
  }));
}
