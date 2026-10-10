import { hasFeeCaveat, resolveFee, type FeeModel } from "@/lib/feeModel";
import { FeeValue } from "./FeeValue";
import { safeHttpUrl } from "./offerModel";

export interface OfferFees {
  accountFeeCents: number | null;
  accountFeeWaiverCondition: string | null;
  cardFeeCents: number | null;
  cardFeeWaiverCondition: string | null;
  otherFee: string | null;
  /** The bank's own fee table (Taryfa opłat i prowizji / DDO). */
  sourceUrl: string | null;
}

function FeeNote({ fee }: { fee: FeeModel }) {
  if (fee.kind === "conditional" && fee.waiver) {
    return (
      <p className="mt-1 break-words text-small text-ink-700 [overflow-wrap:anywhere]">
        {fee.waiverNote}: {fee.waiver}
      </p>
    );
  }
  if (fee.kind === "unknown" && fee.waiver) {
    // A waiver is known but the rate without it is not: say both, never "0 zł".
    return (
      <p className="mt-1 break-words text-small text-ink-700 [overflow-wrap:anywhere]">
        Znany warunek zwolnienia: {fee.waiver}. Stawki poza warunkiem nie zweryfikowaliśmy.
      </p>
    );
  }
  return null;
}

function FeeRow({ label, fee }: { label: string; fee: FeeModel }) {
  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <th scope="row" className="w-2/5 py-3.5 pl-4 pr-3 text-left text-ui font-medium text-ink-700 sm:w-1/3 sm:pl-5">
        {label}
      </th>
      <td className="min-w-0 py-3.5 pr-4 text-ui sm:pr-5">
        <FeeValue fee={fee} className="text-ink-900" />
        <FeeNote fee={fee} />
      </td>
    </tr>
  );
}

/**
 * "Opłaty za konto i kartę": a compact two-row table, ONE shared footnote and
 * the free-text "Inne opłaty:" - no asterisks anywhere. The values come from the
 * shared fee model (src/lib/feeModel.ts), the same one the FAQ and the JSON-LD
 * of this page use.
 *
 *   Brak danych      the fee is not verified (no Fees row, or the field is empty).
 *                    NEVER shown as 0 zł.
 *   0 zł             confirmed 0 zł without a condition and without a remark.
 *   od 0 zł          0 zł is the best case: "Inne opłaty" describes the catch.
 *   12 zł + note     the rate WITHOUT the condition, with "0 zł po spełnieniu warunku: ...".
 *
 * ATM fees are not shown on purpose (owner's rule). Long conditions wrap
 * (break-words) instead of overflowing a phone screen.
 */
export function FeesSection({ fees }: { fees: OfferFees | null }) {
  const caveat = hasFeeCaveat(fees?.otherFee);
  const account = resolveFee(fees?.accountFeeCents, fees?.accountFeeWaiverCondition, caveat);
  const card = resolveFee(fees?.cardFeeCents, fees?.cardFeeWaiverCondition, caveat);
  const anyUnknown = account.kind === "unknown" || card.kind === "unknown";
  const anyFromZero = [account, card].some((fee) => fee.kind === "free" && fee.hasCaveat);
  const otherFee = fees?.otherFee?.trim() ?? "";
  const feeTableUrl = safeHttpUrl(fees?.sourceUrl);

  return (
    <section id="oplaty" aria-labelledby="oplaty-h" className="scroll-mt-20">
      <h2 id="oplaty-h">Opłaty za konto i kartę</h2>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Opłaty za konto i kartę w tej promocji</caption>
          <tbody>
            <FeeRow label="Opłata za konto" fee={account} />
            <FeeRow label="Opłata za kartę" fee={card} />
          </tbody>
        </table>
      </div>

      {anyFromZero ? (
        <p className="mt-2 text-small text-ink-500">
          „Od 0 zł” to stawka w najlepszym przypadku – zależnie od warunków może być wyższa. Szczegóły są niżej, w
          „Inne opłaty”.
        </p>
      ) : null}

      {anyUnknown ? (
        <p className="mt-2 text-small text-ink-500">
          Brak danych = nie zweryfikowaliśmy tej opłaty,{" "}
          {feeTableUrl ? (
            <>
              sprawdź{" "}
              <a href={feeTableUrl} target="_blank" rel="noopener noreferrer nofollow" className="link-inline">
                tabelę opłat banku<span className="sr-only"> (otwiera się w nowej karcie)</span>
              </a>
              .
            </>
          ) : (
            "sprawdź tabelę opłat banku."
          )}
        </p>
      ) : null}

      {otherFee ? (
        <p className="mt-4 whitespace-pre-line break-words text-article text-ink-700 [overflow-wrap:anywhere]">
          <span className="font-semibold text-ink-900">Inne opłaty:</span> {otherFee}
        </p>
      ) : null}
    </section>
  );
}
