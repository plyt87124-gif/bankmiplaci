import Link from "next/link";
import Image from "next/image";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EffortMeter } from "@/components/ui/EffortMeter";
import { formatPLN, formatDate, DIFFICULTY_LABEL, DIFFICULTY_EFFORT } from "@/lib/format";
import type { Difficulty, AccountType } from "@prisma/client";

export interface PromotionCardData {
  slug: string;
  name: string;
  maxBonusCents: number;
  difficulty: Difficulty;
  accountType: AccountType;
  rating: number;
  ratingReason?: string | null;
  endDate: Date;
  summary?: string | null;
  fees?: { accountFeeCents: number } | null;
  conditions?: { title: string }[];
  bank: { name: string; logoUrl?: string | null };
}

const DIFFICULTY_TONE: Record<Difficulty, "teal" | "gold" | "coral"> = {
  VERY_EASY: "teal",
  EASY: "teal",
  MEDIUM: "gold",
  HARD: "coral"
};

export function PromotionCard({ promotion }: { promotion: PromotionCardData }) {
  const isFree = !promotion.fees || promotion.fees.accountFeeCents === 0;

  return (
    <Link
      href={`/promocje/${promotion.slug}`}
      className="group block rounded-xl2 border border-ink-100 bg-surface p-5 shadow-card transition-shadow hover:shadow-cardHover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="relative h-11 w-full max-w-[170px]">
          {promotion.bank.logoUrl ? (
            <Image
              src={promotion.bank.logoUrl}
              alt={promotion.bank.name}
              fill
              sizes="170px"
              className="object-contain object-left"
            />
          ) : (
            <div className="flex h-full items-center gap-2 text-ink-700">
              <Building2 className="h-5 w-5 shrink-0 text-ink-400" />
              <span className="font-display text-base font-semibold">{promotion.bank.name}</span>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-500">{promotion.bank.name}</p>
      {/* Reserve space for exactly 2 lines regardless of actual title
          length, so the "Do / kwota" row below starts at the same Y
          position across every card in a grid row — a 1-line title
          shouldn't leave the amount higher than next to a 2-line one. */}
      <p className="mt-1 line-clamp-2 min-h-[3rem] font-display text-base font-semibold text-ink-900">
        {promotion.name}
      </p>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="text-xs text-ink-500">Do</p>
          <p className="font-display text-3xl font-semibold text-ink-900">{formatPLN(promotion.maxBonusCents)}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-medium text-ink-700">{Number(promotion.rating).toFixed(1)}/10</p>
          <p className="text-xs text-ink-500">ocena serwisu</p>
        </div>
      </div>

      <EffortMeter level={DIFFICULTY_EFFORT[promotion.difficulty] as 1 | 2 | 3 | 4 | 5} className="mt-4" />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={DIFFICULTY_TONE[promotion.difficulty]}>{DIFFICULTY_LABEL[promotion.difficulty]}</Badge>
        {isFree && <Badge tone="teal">Bez opłat za prowadzenie*</Badge>}
        <Badge tone="neutral">Do {formatDate(promotion.endDate)}</Badge>
      </div>

      <span className="mt-4 inline-flex items-center text-sm font-medium text-teal-700 group-hover:underline">
        Sprawdź promocję →
      </span>
    </Link>
  );
}
