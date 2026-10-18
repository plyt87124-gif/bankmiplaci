import { Badge } from "@/components/ui/Badge";
import { BankLogo } from "@/components/ui/BankLogo";
import { VerifiedLine } from "@/components/trust/VerifiedLine";
import { ACCOUNT_TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AccountType } from "@prisma/client";

/** Summaries longer than this are set as body text: a 19-21 px serif lead would run to six lines. */
export const LEAD_MAX_CHARS = 240;

/**
 * Top of an offer page: logo tile (lg) with the bank's name as an overline, the
 * H1 (= the offer's name, so two offers of one bank never share a heading),
 * the account-type and verification badges, and the summary as the lead.
 * The lead is the stored `summary` as it is - empty means nothing is shown
 * (nothing is invented).
 */
export function OfferHeader({
  name,
  summary,
  accountType,
  bank,
  lastVerifiedAt,
  ended,
  draft,
  now
}: {
  name: string;
  summary: string | null;
  accountType: AccountType;
  bank: { name: string; logoUrl: string | null };
  lastVerifiedAt: Date | string | null;
  /** The sign-up deadline has passed: grey logo and an "Zakończona" badge. */
  ended: boolean;
  draft: boolean;
  now?: Date;
}) {
  const lead = summary?.replace(/\s+/g, " ").trim() ?? "";

  return (
    <header className="mt-5 md:mt-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span style={{ viewTransitionName: "vt-logo" }} className="inline-flex">
          <BankLogo name={bank.name} logoUrl={bank.logoUrl} size="lg" grayscale={ended} priority />
        </span>
        <p className="type-label text-ink-500">{bank.name}</p>
      </div>

      <h1 style={{ viewTransitionName: "vt-title" }} className="mt-4 max-w-3xl break-words">
        {name}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span style={{ viewTransitionName: "vt-type" }} className="inline-flex">
          <Badge variant="neutral">{ACCOUNT_TYPE_LABEL[accountType]}</Badge>
        </span>
        {/* The badge variant lays its text, date and suffix out as separate flex items, which breaks a long
            "dane mogą być nieaktualne" line into three islands on a phone; the arbitrary variants below make
            the badge's content flow as one inline run. */}
        <span style={{ viewTransitionName: "vt-verified" }} className="inline-flex max-w-full">
          <VerifiedLine
            lastVerifiedAt={lastVerifiedAt}
            now={now}
            badge
            className="max-w-full [&>span]:inline-block [&>span>svg]:mr-1.5 [&>span>svg]:inline [&>span>svg]:align-text-bottom"
          />
        </span>
        {ended ? <Badge variant="danger">Zakończona</Badge> : null}
        {draft ? <Badge variant="info">Roboczy</Badge> : null}
      </div>

      {lead ? (
        <p
          className={cn(
            "mt-4 max-w-2xl text-ink-700",
            lead.length > LEAD_MAX_CHARS ? "text-article lg:text-article-lg" : "type-lead"
          )}
        >
          {lead}
        </p>
      ) : null}
    </header>
  );
}
