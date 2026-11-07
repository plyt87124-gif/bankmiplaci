import Link from "next/link";
import { XCircle } from "lucide-react";
import { isDeadlinePassed } from "@/lib/promotionAvailability";
import { formatDatePL } from "@/lib/format";

/** The linked offer of an article, reduced to what the notice needs. */
export interface LinkedOffer {
  slug: string;
  name: string;
  endDate: Date;
}

/**
 * The offer an article is a guide to has ended: true once its last sign-up day
 * (Polish calendar) has passed, whether or not the cron has flipped the stored
 * status yet. No linked offer, no notice.
 */
export function endedLinkedOffer(offer: LinkedOffer | null | undefined, now: Date = new Date()): LinkedOffer | null {
  if (!offer) return null;
  return isDeadlinePassed(offer.endDate, now) ? offer : null;
}

/**
 * Banner above the text of an article whose offer has ended. The text itself is
 * left as written (it describes the conditions while the offer ran); the banner
 * says so in plain words, so an old guide can never read as a live offer. Same
 * wording as the notice on the offer page ("Ta promocja zakończyła się ...").
 */
export function EndedOfferNotice({ offer, className }: { offer: LinkedOffer; className?: string }) {
  return (
    <div
      data-notice="oferta-zakonczona"
      role="note"
      className={`flex items-start gap-3 rounded-card border border-coral-600/40 bg-coral-100 p-4 sm:p-5 ${className ?? ""}`.trim()}
    >
      <XCircle size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-coral-600" />
      <div className="min-w-0 text-ui text-ink-700">
        <p className="font-semibold text-coral-600">Ta promocja zakończyła się {formatDatePL(offer.endDate)}</p>
        <p className="mt-1">
          Ten artykuł opisuje warunki oferty „{offer.name}” z czasu, gdy była dostępna. Nie skorzystasz już z niej na
          opisanych zasadach.{" "}
          <Link href="/promocje" className="link-inline font-medium">
            Zobacz aktualne promocje
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
