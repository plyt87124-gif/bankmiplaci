import type { ReactNode } from "react";
import Link from "next/link";
import { Eye, ShieldAlert, XCircle, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { OfferState } from "./offerModel";

type NoticeTone = "info" | "neutral" | "warn" | "danger";

const TONE: Record<NoticeTone, { box: string; icon: string; title: string }> = {
  // The body text stays ink-700/900 in every tone; colour only carries the icon and the title.
  info: { box: "border-line bg-sunken", icon: "text-info", title: "text-ink-900" },
  neutral: { box: "border-line bg-sunken", icon: "text-ink-500", title: "text-ink-900" },
  warn: { box: "border-line bg-warn-100", icon: "text-warn", title: "text-warn" },
  danger: { box: "border-line bg-coral-100", icon: "text-coral-600", title: "text-coral-600" }
};

function Notice({
  tone,
  icon: Icon,
  title,
  children,
  id
}: {
  tone: NoticeTone;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  id?: string;
}) {
  const style = TONE[tone];
  return (
    <div id={id} data-notice={id} className={cn("mt-4 flex items-start gap-3 rounded-card border p-4 sm:p-5", style.box)}>
      <Icon size={22} aria-hidden="true" className={cn("mt-0.5 shrink-0", style.icon)} />
      <div className="min-w-0 text-ui text-ink-700">
        <p className={cn("font-semibold", style.title)}>{title}</p>
        <div className="mt-1 space-y-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * The banners at the top of an offer page: admin preview of a draft, an offer
 * that has ended, one we no longer promote, and one whose partner link is
 * switched off. Several can apply at once (a draft past its deadline).
 */
export function OfferNotices({
  state,
  endDateText,
  bankName,
  /** Where "aktualne promocje" leads: an in-page anchor when the bank has other current offers, else the list. */
  currentOffersHref,
  regulationUrl
}: {
  state: OfferState;
  /** dd.mm.rrrr of the last sign-up day (empty when unknown). */
  endDateText: string;
  bankName: string;
  currentOffersHref: string;
  regulationUrl: string | null;
}) {
  const offersLink = (
    <Link href={currentOffersHref} className="link-inline font-medium">
      {currentOffersHref.startsWith("#") ? `Zobacz aktualne promocje ${bankName}` : "Zobacz aktualne promocje"}
    </Link>
  );

  return (
    <>
      {state.draft ? (
        <Notice tone="info" icon={Eye} title="Podgląd administratora" id="podglad">
          <p>
            Ta promocja ma status „Wersja robocza” i nie jest widoczna publicznie ani indeksowana przez wyszukiwarki.
            Zobaczysz ją tylko Ty, będąc zalogowanym/ą do panelu.
          </p>
        </Notice>
      ) : null}

      {state.deadlinePassed ? (
        <Notice
          tone="danger"
          icon={XCircle}
          title={endDateText ? `Ta promocja zakończyła się ${endDateText}` : "Ta promocja się zakończyła"}
          id="zakonczona"
        >
          <p>
            Zostawiamy jej opis jako archiwalny – nie skorzystasz już z tej oferty na podanych warunkach. {offersLink}.
          </p>
        </Notice>
      ) : null}

      {state.notPromoted ? (
        <Notice tone="warn" icon={Clock} title="Nie udostępniamy już linku do tej oferty" id="nie-promujemy">
          <p>
            Termin zapisów podany w regulaminie banku to {endDateText || "brak danych"} – przed podjęciem decyzji
            sprawdź jej aktualność na stronie banku. {offersLink}.
          </p>
        </Notice>
      ) : null}

      {state.affiliateOff ? (
        <Notice tone="neutral" icon={ShieldAlert} title="Nie udostępniamy teraz linku do tej oferty" id="brak-linku">
          <p>
            Według regulaminu banku oferta jest aktualna (zapisy do {endDateText || "brak danych"}), ale nie
            udostępniamy obecnie naszego linku do niej. Warunki znajdziesz poniżej
            {regulationUrl ? (
              <>
                {" "}
                i w{" "}
                <a href={regulationUrl} target="_blank" rel="noopener noreferrer nofollow" className="link-inline">
                  regulaminie promocji<span className="sr-only"> (otwiera się w nowej karcie)</span>
                </a>
              </>
            ) : (
              " i w regulaminie banku"
            )}
            {" "}– przed decyzją sprawdź ich aktualność na stronie banku.
          </p>
        </Notice>
      ) : null}
    </>
  );
}
