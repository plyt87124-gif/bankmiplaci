/**
 * Database reads of /banki and /banki/[slug]. Public data only: the bank's
 * name, logo and description, slim rows of its non-draft offers (name, status,
 * type, last day), and - for the current offers - the public cards of
 * services/promotionCards.ts (no affiliate URL, no commission). `cache()`
 * de-duplicates inside one request (generateMetadata + page).
 */
import { cache } from "react";
import type { PromotionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getBankCards, type PromotionCardData } from "@/lib/services/promotionCards";
import { activeWhere } from "@/lib/services/promotions";
import {
  BANK_PAGE_STATUSES,
  BANK_VISIBLE_STATUSES,
  isPlausibleBankSlug,
  resolveBankPage,
  sortBanks,
  type BankIndexRow,
  type BankOfferRow,
  type BankRecord
} from "./banks";

export interface BankPageData {
  bank: BankRecord;
  /** Every non-draft offer of the bank (ACTIVE, EXPIRED, ARCHIVED), newest deadline first. */
  offers: BankOfferRow[];
  indexable: boolean;
}

/** The bank page's data, or null (-> notFound()) for an unknown slug or a bank with nothing public. */
export const getBankPage = cache(async (slug: string): Promise<BankPageData | null> => {
  if (!isPlausibleBankSlug(slug)) return null;
  const row = await db.bank.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      description: true,
      promotions: {
        where: { status: { in: [...BANK_VISIBLE_STATUSES] as PromotionStatus[] } },
        select: { slug: true, name: true, status: true, accountType: true, endDate: true },
        orderBy: { endDate: "desc" }
      }
    }
  });
  if (!row) return null;

  const bank: BankRecord = { slug: row.slug, name: row.name, logoUrl: row.logoUrl, description: row.description };
  const offers: BankOfferRow[] = row.promotions;
  const state = resolveBankPage(bank, offers);
  if (state.kind === "not-found") return null;
  return { bank, offers, indexable: state.indexable };
});

/** The bank's current offers as public cards, in the default "Polecane" order. */
export const getBankOpenCards = cache((slug: string): Promise<PromotionCardData[]> => getBankCards(slug));

/**
 * Banks listed on /banki: those with at least one ACTIVE or EXPIRED offer
 * (the same rule as the sitemap), with the number of current offers,
 * alphabetically.
 */
export const listBankIndex = cache(async (): Promise<BankIndexRow[]> => {
  const rows = await db.bank.findMany({
    where: { promotions: { some: { status: { in: [...BANK_PAGE_STATUSES] as PromotionStatus[] } } } },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      promotions: { where: activeWhere(), select: { id: true } }
    }
  });
  return sortBanks(rows.map((row) => ({ slug: row.slug, name: row.name, logoUrl: row.logoUrl, activeCount: row.promotions.length })));
});
