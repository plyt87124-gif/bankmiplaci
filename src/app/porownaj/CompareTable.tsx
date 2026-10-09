import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { AffiliateCtaLink } from "@/components/AffiliateCtaLink";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { AffiliateLinkBadge } from "@/components/trust/TrustNote";
import { DeadlineBadge } from "@/components/trust/DeadlineBadge";
import { VerifiedLine } from "@/components/trust/VerifiedLine";
import { BankLogo } from "@/components/ui/BankLogo";
import { ButtonLink } from "@/components/ui/Button";
import { EffortMeter } from "@/components/ui/EffortMeter";
import { cn } from "@/lib/cn";
import { outboundHref } from "@/lib/affiliate";
import { DIFFICULTY_LEVEL, formatPLN, formatRatingOutOf10, pluralizePl } from "@/lib/format";
import { deadlineState } from "@/lib/freshness";
import type { PromotionCardData } from "@/lib/services/promotionCards";
import type { CompareExtras } from "./data";
import { bestFlags, cooldownLines, describeFee, feeRank, type FeeView } from "./compareModel";

export interface CompareColumn {
  card: PromotionCardData;
  /** Missing = we could not read the extras: no CTA, karencja "Brak danych". */
  extras: CompareExtras | undefined;
}

/** Column geometry (px): label column and one offer column, phone and from `sm`. */
const MOBILE = { label: 104, offer: 148 };
const WIDE = { label: 152, offer: 184 };

const SR_BEST = "najlepsza wartość w wierszu";

function Missing() {
  return <span className="text-ink-500">Brak danych</span>;
}

/** The value of a row: medium weight; the best one is bold and gets a check mark + a word for screen readers. */
function Value({ best, children }: { best?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "num inline-flex flex-wrap items-baseline gap-x-1 text-ink-900",
        best ? "font-bold" : "font-medium"
      )}
    >
      <span>{children}</span>
      {best ? (
        <>
          <Check size={14} aria-hidden="true" className="relative top-[1px] shrink-0 self-center" />
          <span className="sr-only">{SR_BEST}</span>
        </>
      ) : null}
    </span>
  );
}

function FeeCell({ fee, best }: { fee: FeeView; best: boolean }) {
  switch (fee.kind) {
    case "unknown":
      return <Missing />;
    case "free":
      return <Value best={best}>{formatPLN(0)}</Value>;
    case "paid":
      return <Value best={best}>{formatPLN(fee.cents)}</Value>;
    case "conditional":
      return (
        <>
          <Value best={best}>{formatPLN(fee.cents)}*</Value>
          <p className="mt-1 text-caption text-ink-500">Zwolnienie: {fee.condition}</p>
        </>
      );
  }
}

function DeadlineCell({ endDate }: { endDate: Date }) {
  const info = deadlineState(endDate);
  if (info.state === "unknown") return <Missing />;
  const urgent = info.state === "soon" || info.state === "urgent" || info.state === "ended";
  return (
    <>
      <time dateTime={info.iso ?? undefined} className="num block font-medium text-ink-900">
        {info.dateText}
      </time>
      {urgent ? (
        <DeadlineBadge endDate={endDate} className="mt-1.5 h-auto whitespace-normal py-1" />
      ) : info.days !== null ? (
        <p className="mt-0.5 text-caption text-ink-500">
          Do końca: {info.days} {pluralizePl(info.days, "dzień", "dni", "dni")}
        </p>
      ) : null}
    </>
  );
}

function CooldownCell({ extras }: { extras: CompareExtras | undefined }) {
  const lines = extras ? cooldownLines(extras.cooldownMonths, extras.cooldownCutoffDate) : [];
  if (lines.length === 0) {
    return (
      <>
        <Missing />
        <p className="mt-1 text-caption text-ink-500">Sprawdź warunki w ofercie.</p>
      </>
    );
  }
  return (
    <>
      {lines.map((line) => (
        <p key={line} className="font-medium text-ink-900">
          {line}
        </p>
      ))}
    </>
  );
}

function ActionCell({ card, extras }: CompareColumn) {
  const showCta = extras?.affiliateLinkEnabled === true;
  return (
    <div className="flex flex-col gap-2">
      <ButtonLink href={`/promocje/${card.slug}`} variant="secondary" size="sm" fullWidth>
        Szczegóły
      </ButtonLink>
      {showCta ? (
        <div className="flex flex-col items-stretch gap-1.5">
          <AffiliateLinkBadge className="self-start" />
          {/* target="_self": the comparison does not open new tabs. */}
          <AffiliateCtaLink href={outboundHref(card.slug, { source: "compare-table" })} size="sm" fullWidth target="_self">
            Przejdź do promocji
          </AffiliateCtaLink>
          <AffiliateDisclosure variant="compact" className="mt-0" />
        </div>
      ) : null}
    </div>
  );
}

const LABEL_CELL =
  "sticky left-0 z-10 border-b border-r border-line border-r-line-strong bg-surface px-2.5 py-3 text-left align-top " +
  "text-caption font-semibold text-ink-700 group-hover:bg-sunken sm:px-4 sm:text-small";
const VALUE_CELL = "snap-start border-b border-line px-3 py-3 align-top text-small text-ink-700 break-words";

interface Row {
  key: string;
  label: string;
  cell: (column: CompareColumn, index: number) => ReactNode;
}

/**
 * The comparison table (design spec section 5, "Table"): caption, `scope`
 * headers, sticky header row and sticky first column, a focusable
 * `role="region"` that scrolls INSIDE itself (the page never scrolls sideways;
 * the label column is 104 px on a phone and the offer columns snap two at a
 * time), rows in the order of a decision, and links only in the column header
 * and the last row. The best value of a row is bold with a check mark and a
 * word for screen readers - never a coloured background.
 */
export function CompareTable({ columns }: { columns: CompareColumn[] }) {
  const n = columns.length;
  const fees = columns.map((c) => ({
    account: describeFee(c.card.fees?.accountFeeCents, c.card.fees?.accountFeeWaiverCondition),
    card: describeFee(c.card.fees?.cardFeeCents, c.card.fees?.cardFeeWaiverCondition)
  }));
  const bestBonus = bestFlags(columns.map((c) => c.card.maxBonusCents), "max");
  const bestEffort = bestFlags(columns.map((c) => DIFFICULTY_LEVEL[c.card.difficulty]), "min");
  const bestAccountFee = bestFlags(fees.map((f) => feeRank(f.account)), "min");
  const bestCardFee = bestFlags(fees.map((f) => feeRank(f.card)), "min");
  const bestRating = bestFlags(columns.map((c) => c.card.rating), "max");

  const rows: Row[] = [
    {
      key: "bonus",
      label: "Premia",
      cell: ({ card }, i) =>
        card.maxBonusCents > 0 ? (
          <Value best={bestBonus[i]}>{formatPLN(card.maxBonusCents)}</Value>
        ) : (
          <span className="text-ink-700">Bez premii gotówkowej</span>
        )
    },
    { key: "deadline", label: "Termin", cell: ({ card }) => <DeadlineCell endDate={card.endDate} /> },
    {
      key: "effort",
      label: "Trudność",
      cell: ({ card }, i) => (
        <span className="inline-flex flex-wrap items-center gap-x-1">
          <EffortMeter difficulty={card.difficulty} className="flex-wrap gap-y-1" />
          {bestEffort[i] ? (
            <>
              <Check size={14} aria-hidden="true" className="shrink-0" />
              <span className="sr-only">{SR_BEST}</span>
            </>
          ) : null}
        </span>
      )
    },
    {
      key: "accountFee",
      label: "Opłata za konto",
      cell: (_c, i) => <FeeCell fee={fees[i]!.account} best={bestAccountFee[i]!} />
    },
    {
      key: "cardFee",
      label: "Opłata za kartę",
      cell: (_c, i) => <FeeCell fee={fees[i]!.card} best={bestCardFee[i]!} />
    },
    { key: "cooldown", label: "Karencja", cell: ({ extras }) => <CooldownCell extras={extras} /> },
    {
      key: "rating",
      label: "Ocena serwisu",
      cell: ({ card }, i) => <Value best={bestRating[i]}>{formatRatingOutOf10(card.rating)}</Value>
    },
    {
      key: "verified",
      label: "Weryfikacja",
      cell: ({ card }) => <VerifiedLine lastVerifiedAt={card.lastVerifiedAt} />
    }
  ];

  const widthVars = {
    "--cmp-min-m": `${MOBILE.label + n * MOBILE.offer}px`,
    "--cmp-min-w": `${WIDE.label + n * WIDE.offer}px`
  } as CSSProperties;

  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={`Tabela porównania ${n} ${pluralizePl(n, "oferty", "ofert", "ofert")}, przewijana poziomo`}
      // `relative`: the sr-only (position:absolute) texts inside the table must be clipped by
      // this frame; without a positioned ancestor they widen the whole PAGE past 320 px.
      className="relative snap-x snap-mandatory scroll-pl-[104px] overflow-auto overscroll-x-contain rounded-card border border-line bg-surface sm:snap-none sm:scroll-pl-0"
    >
      <table
        style={widthVars}
        className="w-full min-w-[var(--cmp-min-m)] table-fixed border-separate border-spacing-0 text-left sm:min-w-[var(--cmp-min-w)]"
      >
        <caption className="sr-only">
          Porównanie wybranych promocji bankowych. Wiersze to kryteria: premia, termin, trudność, opłaty, karencja, ocena
          serwisu i weryfikacja. Kolumny to oferty.
        </caption>
        <colgroup>
          <col className="w-[104px] sm:w-[152px]" />
          {columns.map(({ card }) => (
            <col key={card.slug} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-30 border-b border-r border-line-strong bg-paper p-0 text-left"
            >
              <span className="sr-only">Kryterium</span>
            </th>
            {columns.map(({ card }) => (
              <th
                key={card.slug}
                scope="col"
                className="sticky top-0 z-20 snap-start border-b border-line-strong bg-paper px-3 py-3 text-left align-top font-normal"
              >
                <span aria-hidden="true" className="block">
                  <BankLogo name={card.bank.name} logoUrl={card.bank.logoUrl} size="xs" className="sm:hidden" />
                  <BankLogo name={card.bank.name} logoUrl={card.bank.logoUrl} size="md" className="hidden sm:inline-flex" />
                </span>
                <span className="mt-2 block text-caption text-ink-500">{card.bank.name}</span>
                <Link
                  href={`/promocje/${card.slug}`}
                  className="mt-0.5 block rounded-sm text-small font-semibold text-ink-900 underline-offset-[3px] hover:underline"
                >
                  {card.name}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="group hover:bg-sunken">
              <th scope="row" className={LABEL_CELL}>
                {row.label}
              </th>
              {columns.map((column, i) => (
                <td key={column.card.slug} className={VALUE_CELL}>
                  {row.cell(column, i)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="[&>*]:border-b-0">
            <th scope="row" className={LABEL_CELL}>
              Działania
            </th>
            {columns.map((column) => (
              <td key={column.card.slug} className={VALUE_CELL}>
                <ActionCell {...column} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
