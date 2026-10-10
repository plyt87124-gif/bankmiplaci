import Link from "next/link";
import { ChevronRight, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BankLogo } from "@/components/ui/BankLogo";
import { EffortMeter } from "@/components/ui/EffortMeter";
import { Amount } from "@/components/ui/Money";
import { DeadlineBadge } from "@/components/trust/DeadlineBadge";
import { VerifiedLine } from "@/components/trust/VerifiedLine";
import { cn } from "@/lib/cn";
import { deadlineState } from "@/lib/freshness";
import { ACCOUNT_TYPE_LABEL, formatRatingOutOf10 } from "@/lib/format";
import { nameMentionsBank } from "@/lib/seo/metadata";
import {
  cardLeadLine,
  describeAccountFee,
  hasShowableLogo,
  ratingExplainerHref
} from "@/components/promocje/cardCopy";
import type { AccountType, Difficulty } from "@prisma/client";

/**
 * What a card needs. It accepts the public card of the listing service
 * (PromotionCardData from lib/services/promotionCards.ts, dates as Date), the
 * same card after a JSON round trip (PromotionCardJson: dates as ISO strings,
 * as in the quiz) and the pre-redesign shape; the fields the old callers did
 * not have (`lastVerifiedAt`, `bank.slug`, `status`) are optional.
 *
 * NEVER add a field that is not public here (affiliate URL, commission): the
 * card is rendered into HTML.
 */
export interface PromotionCardData {
  slug: string;
  name: string;
  maxBonusCents: number;
  difficulty: Difficulty;
  accountType: AccountType;
  /** "Ocena serwisu" 0..10 (a Prisma Decimal is accepted too). */
  rating: number | string | { toNumber(): number };
  ratingReason?: string | null;
  /** Last day to join. */
  endDate: Date | string;
  /** Missing = "Brak daty weryfikacji". */
  lastVerifiedAt?: Date | string | null;
  summary?: string | null;
  fees?: { accountFeeCents: number | null; accountFeeWaiverCondition?: string | null } | null;
  conditions?: { title: string }[];
  bank: { name: string; slug?: string; logoUrl?: string | null };
  /** Admin preview of an unpublished offer shows a "Roboczy" badge. */
  status?: "DRAFT" | "ACTIVE" | "EXPIRED" | "ARCHIVED";
}

export interface PromotionCardProps {
  promotion: PromotionCardData;
  /** Position in the list (0-based). The first cards load their logo with priority (LCP). */
  index?: number;
  /** Force or forbid priority loading of the logo (default: index < 3). */
  priority?: boolean;
  /** Heading level of the offer name (default h3: under an h2 section title). */
  headingLevel?: 2 | 3 | 4;
  /** Injectable clock for tests; leave out in pages. */
  now?: Date;
  className?: string;
}

/** How many leading cards get a preloaded logo. */
export const PRIORITY_CARD_COUNT = 3;

/**
 * The links inside a card sit above the stretched link (z-10). Their box is the
 * text (so the focus ring hugs it); a pseudo-element grows the clickable area
 * to a 44 px high touch target without moving anything.
 */
const HIT_AREA =
  "relative z-10 inline-flex items-center before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']";

/**
 * Offer card (design spec section 5). The whole card is ONE link to the offer
 * page: the "stretched link" pattern - the offer name is the real <a> and its
 * ::after covers the card, while "Jak liczymy?" is a separate, focusable link
 * above it (z-10), so there are no nested links. Hover only changes the
 * border and the tint (no lift, no shadow); the amount is the hero; the
 * deadline, fee and verification are single quiet lines. Static - no animation
 * on any decision data. A card never carries an outbound partner link, so it
 * needs no affiliate disclosure of its own (the list has one above it).
 *
 *   ended offer  coral banner "Zakończona dd.mm.rrrr", grey logo, and instead
 *                of "Szczegóły" a link to the bank's current offers
 *   no bonus     maxBonusCents = 0 -> "Bez premii gotówkowej" (the name carries the benefit)
 *   no fee data  "Brak danych", never 0 zł
 */
export function PromotionCard({
  promotion,
  index,
  priority,
  headingLevel = 3,
  now,
  className
}: PromotionCardProps) {
  const { bank } = promotion;
  const deadline = deadlineState(promotion.endDate, now);
  const ended = deadline.state === "ended" || promotion.status === "EXPIRED";
  const draft = promotion.status === "DRAFT";
  const hasBonus = promotion.maxBonusCents > 0;
  const fee = describeAccountFee(promotion.fees);
  const lead = cardLeadLine(promotion.conditions, promotion.summary);
  const hasLogo = hasShowableLogo(bank.logoUrl);
  const prioritizeLogo = priority ?? (index != null && index < PRIORITY_CARD_COUNT);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const bankSaysItself = nameMentionsBank(promotion.name, bank.name);

  return (
    <article
      data-card="promotion"
      data-slug={promotion.slug}
      className={cn(
        "group relative flex h-full flex-col rounded-card border border-line bg-surface p-4 sm:p-5",
        "transition-colors duration-150 ease-out hover:border-line-strong hover:bg-sunken/40",
        className
      )}
    >
      {ended ? (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-coral-100 px-3 py-1.5 text-small font-semibold text-coral-600">
          <XCircle size={16} aria-hidden="true" className="shrink-0" />
          {deadline.state === "ended" ? deadline.detailedLabel : "Zakończona"}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <BankLogo name={bank.name} logoUrl={bank.logoUrl} size="sm" grayscale={ended} priority={prioritizeLogo} />
        <div className="flex flex-wrap items-center gap-1.5">
          {draft ? <Badge variant="info">Roboczy</Badge> : null}
          <Badge variant="neutral">{ACCOUNT_TYPE_LABEL[promotion.accountType]}</Badge>
        </div>
      </div>

      {hasLogo ? null : <p className="type-label mt-3 text-ink-500">{bank.name}</p>}

      <Heading
        className={cn(
          "line-clamp-2 min-h-[3rem] text-h4 leading-6 [overflow-wrap:anywhere] [text-wrap:balance]",
          hasLogo ? "mt-3" : "mt-1"
        )}
      >
        <Link
          href={`/promocje/${promotion.slug}`}
          className={cn(
            "rounded-sm outline-none after:absolute after:inset-0 after:rounded-card after:content-['']",
            "focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-ring"
          )}
        >
          {bankSaysItself ? null : <span className="sr-only">{bank.name}: </span>}
          {promotion.name}
        </Link>
      </Heading>

      <div className="mt-3 min-h-[3.5rem]">
        {hasBonus ? (
          <>
            <p className="type-label text-ink-500">Premia do</p>
            <Amount cents={promotion.maxBonusCents} variant="card" className="block" />
          </>
        ) : (
          <p className="pt-3 text-h4 font-semibold text-ink-700">Bez premii gotówkowej</p>
        )}
      </div>
      {lead ? <p className="mt-1 line-clamp-1 text-small text-ink-500">{lead}</p> : null}

      {/* Two fixed rows at every width, so cards of one grid row line up whatever the label lengths
          (the list grid is 1 / 2 / 3 columns, a card is never wide enough for both labels on one line). */}
      <div className="mt-4 flex flex-col items-start gap-2">
        <EffortMeter difficulty={promotion.difficulty} />
        {ended ? null : <DeadlineBadge endDate={promotion.endDate} now={now} />}
      </div>
      <p className="mt-2 text-small text-ink-700">
        Opłata za konto:{" "}
        <span className={cn("num font-semibold", fee.kind === "unknown" ? "text-ink-500" : "text-ink-900")}>
          {fee.text}
        </span>
        {fee.note ? <span className="whitespace-nowrap text-ink-700"> ({fee.note})</span> : null}
      </p>
      <VerifiedLine lastVerifiedAt={promotion.lastVerifiedAt} now={now} className="mt-2" />

      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
          <div className="min-w-0 text-small">
            <p className="text-ink-700">
              Ocena serwisu{" "}
              <span className="num font-semibold text-ink-900">{formatRatingOutOf10(promotion.rating)}</span>
            </p>
            <Link
              href={ratingExplainerHref()}
              className={cn("link-inline", HIT_AREA)}
            >
              Jak liczymy?
            </Link>
          </div>
          {ended && bank.slug ? (
            <Link
              href={`/promocje?bank=${encodeURIComponent(bank.slug)}`}
              className={cn("link-inline shrink-0 text-small font-semibold", HIT_AREA)}
            >
              Aktualne promocje banku
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex shrink-0 items-center gap-0.5 text-small font-semibold text-action"
            >
              Szczegóły
              <ChevronRight
                size={16}
                className="transition-transform duration-base ease-out group-hover:translate-x-0.5"
              />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
