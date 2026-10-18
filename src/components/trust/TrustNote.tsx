import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  AFFILIATE_BADGE_LABEL,
  COMMENTS_NOTE,
  MARKET_SCOPE_NOTE,
  NOT_BANK_NOTE,
  RATING_NOTE,
  REQUIRES_REFERRAL_NOTICE
} from "@/lib/disclosureCopy";

/**
 * The standing one-line notes of the trust plan (04-trust-and-disclosure-plan.md
 * sections 4 and 5), with their wording from lib/disclosureCopy.ts:
 *   notBank   offer page: "Nie jesteśmy bankiem ani doradcą. Warunki ustala bank."
 *   scope     lists and comparison: "Nie obejmujemy całego rynku ... Jak liczymy ocenę"
 *   comments  under the comment form and list
 *   rating    next to the rating, always: "Ocena serwisu, nie porada finansowa."
 *   referral  only for offers flagged `requiresReferralLink === true`
 * Server component, ink-500, 14 px.
 */
export type TrustNoteKind = "notBank" | "scope" | "comments" | "rating" | "referral";

export function TrustNote({ kind, className }: { kind: TrustNoteKind; className?: string }) {
  const classes = cn("text-small text-ink-500", className);

  if (kind === "scope") {
    return (
      <p data-trust-note={kind} className={classes}>
        {MARKET_SCOPE_NOTE.lead}{" "}
        <Link href={MARKET_SCOPE_NOTE.href} className="link-inline whitespace-nowrap font-medium">
          {MARKET_SCOPE_NOTE.linkLabel}
        </Link>
      </p>
    );
  }

  const text =
    kind === "notBank"
      ? NOT_BANK_NOTE
      : kind === "comments"
        ? COMMENTS_NOTE
        : kind === "rating"
          ? RATING_NOTE
          : REQUIRES_REFERRAL_NOTICE;
  return (
    <p data-trust-note={kind} className={classes}>
      {text}
    </p>
  );
}

/**
 * Outline badge "Link partnerski" - next to a bank button in tables, where
 * the compact disclosure sits under the button as usual.
 */
export function AffiliateLinkBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      {AFFILIATE_BADGE_LABEL}
    </Badge>
  );
}
