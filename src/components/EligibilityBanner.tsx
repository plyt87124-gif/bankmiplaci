"use client";

import { CheckCircle2, Clock, LogIn, XCircle, type LucideIcon } from "lucide-react";
import { ACCOUNT_TYPE_LABEL, formatDatePL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { EligibilityResult } from "@/lib/services/eligibility";
import type { AccountType } from "@prisma/client";
import { useAuthModal } from "@/components/AuthModalProvider";
import { useOptionalSession } from "@/components/SessionProvider";
import { Button } from "@/components/ui/Button";

/**
 * "Can I take part?" banner of the offer page (docs/redesign-v2/01-design-spec.md,
 * EligibilityBanner). Four states; the text is always ink-900 / ink-700 - the
 * colour only supports the icon and the 3 px bar on the left:
 *
 *   eligible       success   CheckCircle2  "Możesz skorzystać od {data}"
 *   waiting        gold      Clock         "Karencja do {data}"
 *   not-eligible   coral     XCircle       "Prawdopodobnie nie kwalifikujesz się: {powód}"
 *   logged-out     info      LogIn         "Zaloguj się, by sprawdzić, czy możesz skorzystać" + button
 *
 * Props `result`, `bankName`, `accountType` are unchanged. `loggedOut` and
 * `className` are optional additions: pass `loggedOut` to show the sign-in
 * prompt; without it the banner also shows the prompt when the session
 * provider already knows the visitor is signed out. An "unknown" result of a
 * signed-in user renders nothing (there is nothing to say).
 */
type BannerState = "eligible" | "waiting" | "not-eligible" | "logged-out";

const STATE_STYLE: Record<BannerState, { bar: string; icon: LucideIcon; iconClass: string }> = {
  eligible: { bar: "border-l-success", icon: CheckCircle2, iconClass: "text-success" },
  waiting: { bar: "border-l-gold-500", icon: Clock, iconClass: "text-gold-600" },
  "not-eligible": { bar: "border-l-coral-600", icon: XCircle, iconClass: "text-coral-600" },
  "logged-out": { bar: "border-l-info", icon: LogIn, iconClass: "text-info" }
};

export function EligibilityBanner({
  result,
  bankName,
  accountType,
  loggedOut,
  className
}: {
  result: EligibilityResult;
  bankName: string;
  accountType: AccountType;
  /** Force (true) or suppress (false) the signed-out prompt; omit to follow the session. */
  loggedOut?: boolean;
  className?: string;
}) {
  const session = useOptionalSession();
  const isLoggedOut = loggedOut ?? session?.status === "unauthenticated";

  if (isLoggedOut) return <Shell state="logged-out" className={className} title="Zaloguj się, by sprawdzić, czy możesz skorzystać" />;
  if (result.status === "unknown") return null;

  const accountLabel = ACCOUNT_TYPE_LABEL[accountType].toLowerCase();
  const from = result.eligibleFromDate ? formatDatePL(result.eligibleFromDate) : "";

  if (result.status === "eligible") {
    return (
      <Shell
        state="eligible"
        className={className}
        title={from ? `Możesz skorzystać od ${from}` : "Możesz skorzystać"}
      >
        <p>
          Według Twojej historii bankowej dla konta typu „{accountLabel}” okres karencji w {bankName} już minął —
          możesz skorzystać z tej promocji, o ile spełniasz pozostałe warunki.
        </p>
      </Shell>
    );
  }

  if (result.currentClient) {
    return (
      <Shell state="not-eligible" className={className} title="Jesteś obecnie klientem tego banku">
        <p>
          Zaznaczyłeś/aś w swoim koncie, że masz teraz konto w {bankName} (typ „{accountLabel}”). Ta promocja ma okres
          karencji, więc prawdopodobnie nie możesz z niej skorzystać, dopóki nie zamkniesz konta i nie wpiszesz daty
          zamknięcia w „Moje konto”.
        </p>
      </Shell>
    );
  }

  // not-eligible: a fixed cut-off date never resolves by waiting; a cooldown does.
  if (!result.cutoffFailed && from) {
    return (
      <Shell state="waiting" className={className} title={`Karencja do ${from}`}>
        <p>
          Według dat, które podałeś/aś w swoim koncie, okres karencji w {bankName} kończy się {from}.
          Prawdopodobnie nie kwalifikujesz się do tej promocji wcześniej.
        </p>
      </Shell>
    );
  }

  return (
    <Shell
      state="not-eligible"
      className={className}
      title={
        result.cutoffFailed
          ? "Prawdopodobnie nie kwalifikujesz się: konto zamknięte po dacie granicznej"
          : "Prawdopodobnie nie kwalifikujesz się do tej promocji"
      }
    >
      {result.cutoffFailed && (
        <p>
          Bank wymaga, aby konto zostało zamknięte przed określoną datą graniczną, a według danych w Twoim koncie
          Twoje konto w {bankName} było czynne później niż ta data. To niestety zwykle oznacza trwałe wykluczenie z
          tej konkretnej promocji, niezależne od upływu czasu.
        </p>
      )}
    </Shell>
  );
}

function Shell({
  state,
  title,
  className,
  children
}: {
  state: BannerState;
  title: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const { bar, icon: Icon, iconClass } = STATE_STYLE[state];
  return (
    <div
      data-eligibility={state}
      className={cn("mt-4 rounded-card border border-l-[3px] border-line bg-sunken p-4 sm:p-5", bar, className)}
    >
      <div className="flex items-start gap-3">
        <Icon size={24} aria-hidden="true" className={cn("mt-0.5 shrink-0", iconClass)} />
        <div className="min-w-0 text-ui text-ink-700">
          <p className="font-semibold text-ink-900">{title}</p>
          {state === "logged-out" ? <LoggedOutBody /> : <div className="mt-1 space-y-1">{children}</div>}
        </div>
      </div>
      <p className="mt-3 text-small text-ink-500 sm:pl-9">
        Zawsze sprawdź warunki uczestnictwa w regulaminie banku (link w sekcji Źródło).
      </p>
    </div>
  );
}

function LoggedOutBody() {
  const { openAuth } = useAuthModal();
  return (
    <>
      <p className="mt-1">
        Na podstawie dat zamknięcia kont, które podasz w „Moje konto”, oszacujemy, czy minął okres karencji dla tej
        promocji.
      </p>
      <Button variant="secondary" className="mt-3" onClick={() => openAuth({ mode: "login" })}>
        Zaloguj się
      </Button>
    </>
  );
}
