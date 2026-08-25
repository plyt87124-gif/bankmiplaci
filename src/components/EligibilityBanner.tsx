import { CalendarClock, CheckCircle2 } from "lucide-react";
import { formatDate, ACCOUNT_TYPE_LABEL } from "@/lib/format";
import type { EligibilityResult } from "@/lib/services/eligibility";
import type { AccountType } from "@prisma/client";

export function EligibilityBanner({
  result,
  bankName,
  accountType
}: {
  result: EligibilityResult;
  bankName: string;
  accountType: AccountType;
}) {
  if (result.status === "unknown") return null;
  const accountLabel = ACCOUNT_TYPE_LABEL[accountType].toLowerCase();

  if (result.status === "eligible") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-xl2 border border-teal-100 bg-teal-100/40 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
        <p className="text-sm text-teal-700">
          Według Twojej historii bankowej dla konta typu „{accountLabel}” okres karencji w {bankName} już minął
          — możesz skorzystać z tej promocji, o ile spełniasz pozostałe warunki.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl2 border border-gold-100 bg-gold-100/40 p-4">
      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
      <div className="text-sm text-ink-700">
        <p className="font-medium">Prawdopodobnie nie kwalifikujesz się jeszcze do tej promocji.</p>
        {result.cutoffFailed ? (
          <p className="mt-1 text-ink-500">
            Bank wymaga, aby konto zostało zamknięte przed określoną datą graniczną, a według danych w Twoim
            koncie Twoje konto w {bankName} było czynne później niż ta data. To niestety zwykle oznacza
            trwałe wykluczenie z tej konkretnej promocji, niezależne od upływu czasu.
          </p>
        ) : (
          <p className="mt-1 text-ink-500">
            Według dat, które podałeś/aś w swoim koncie, okres karencji w {bankName} kończy się{" "}
            {result.eligibleFromDate && formatDate(result.eligibleFromDate)}.
          </p>
        )}
        <p className="mt-1 text-ink-300">
          To automatyczne oszacowanie na podstawie Twoich danych — zawsze zweryfikuj to z sekcją „Dla kogo jest
          promocja?” poniżej.
        </p>
      </div>
    </div>
  );
}
