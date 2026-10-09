import { Money } from "@/components/ui/Money";
import { describeFee, safeHttpUrl, type FeeLine } from "./offerModel";

export interface OfferFees {
  accountFeeCents: number | null;
  accountFeeWaiverCondition: string | null;
  cardFeeCents: number | null;
  cardFeeWaiverCondition: string | null;
  otherFee: string | null;
  /** The bank's own fee table (Taryfa opłat i prowizji / DDO). */
  sourceUrl: string | null;
}

function FeeNote({ fee }: { fee: FeeLine }) {
  if (fee.kind === "conditional" && fee.waiver) {
    return (
      <p className="mt-1 break-words text-small text-ink-700 [overflow-wrap:anywhere]">
        0&nbsp;zł po spełnieniu warunku: {fee.waiver}
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

function FeeRow({ label, fee }: { label: string; fee: FeeLine }) {
  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <th scope="row" className="w-2/5 py-3.5 pl-4 pr-3 text-left text-ui font-medium text-ink-700 sm:w-1/3 sm:pl-5">
        {label}
      </th>
      <td className="min-w-0 py-3.5 pr-4 text-ui sm:pr-5">
        <Money cents={fee.cents} className="text-ink-900" />
        <FeeNote fee={fee} />
      </td>
    </tr>
  );
}

/**
 * "Opłaty za konto i kartę": a compact two-row table, ONE shared footnote and
 * the free-text "Inne opłaty:" - no asterisks anywhere.
 *
 *   Brak danych      the fee is not verified (no Fees row, or the field is empty).
 *                    NEVER shown as 0 zł.
 *   0 zł             confirmed 0 zł without a condition.
 *   12 zł + note     the rate WITHOUT the condition, with "0 zł po spełnieniu warunku: ...".
 *
 * ATM fees are not shown on purpose (owner's rule). Long conditions wrap
 * (break-words) instead of overflowing a phone screen.
 */
export function FeesSection({ fees }: { fees: OfferFees | null }) {
  const account = describeFee(fees?.accountFeeCents, fees?.accountFeeWaiverCondition);
  const card = describeFee(fees?.cardFeeCents, fees?.cardFeeWaiverCondition);
  const anyUnknown = account.kind === "unknown" || card.kind === "unknown";
  const otherFee = fees?.otherFee?.trim() ?? "";
  const feeTableUrl = safeHttpUrl(fees?.sourceUrl);

  return (
    <section aria-labelledby="oplaty-h">
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
