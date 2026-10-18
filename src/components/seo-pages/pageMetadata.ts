/**
 * <head> metadata of the SEO landing pages. Pure (the clock and the data are
 * arguments), so tests/seo-pages*.test.tsx can check titles, canonicals and
 * robots without a database. Titles and descriptions come from the SEO
 * library (src/lib/seo/metadata.ts); /banki has no builder there yet and uses
 * the small constants below with `buildMetadata`.
 *
 * Index policy shared by every page here:
 * - any filter/sort/paging parameter makes the URL `noindex,follow` and the
 *   canonical stays on the clean path (noindexForSearchParams);
 * - a bank page is `noindex` when the bank has no offer the sitemap lists
 *   (see banks.ts#isBankIndexable), exactly the rule that decides whether
 *   sitemap.xml lists it, so the two never disagree.
 */
import type { Metadata } from "next";
import {
  ENDING_SOON_DESCRIPTION,
  bankDescription,
  bankTitle,
  buildMetadata,
  endingSoonTitle,
  hubDescription,
  hubTitle,
  noindexForSearchParams,
  type HubKind
} from "@/lib/seo";
import { pluralizePl } from "@/lib/format";
import { HUBS } from "./hubs";

type SearchParams = Record<string, string | string[] | undefined> | URLSearchParams | undefined | null;

const NOINDEX = { index: false, follow: true } as const;

export function hubMetadata(kind: HubKind, count: number, searchParams: SearchParams, now: Date): Metadata {
  return buildMetadata({
    title: { absolute: hubTitle(kind, now) },
    description: hubDescription(kind, count),
    path: HUBS[kind].path,
    robots: noindexForSearchParams(searchParams) ?? null
  });
}

/** /banki - the title goes through the layout template ("... | Bankmiplaci"). */
export const BANK_INDEX_TITLE = "Banki z promocjami – lista banków i ich ofert";

export function bankIndexDescription(bankCount: number): string {
  const lead =
    bankCount > 0
      ? `${bankCount} ${pluralizePl(bankCount, "bank", "banki", "banków")} z promocjami, które analizujemy: `
      : "Banki z promocjami, które analizujemy: ";
  return `${lead}konta osobiste i firmowe. Sprawdź aktualne oferty każdego z nich oraz zakończone promocje.`;
}

export function bankIndexMetadata(bankCount: number, searchParams: SearchParams): Metadata {
  return buildMetadata({
    title: BANK_INDEX_TITLE,
    description: bankIndexDescription(bankCount),
    path: "/banki",
    robots: noindexForSearchParams(searchParams) ?? null
  });
}

export function bankMetadata(
  bank: { name: string; slug: string },
  activeCount: number,
  indexable: boolean,
  searchParams: SearchParams,
  now: Date
): Metadata {
  return buildMetadata({
    title: { absolute: bankTitle(bank.name, now) },
    description: bankDescription(bank.name, activeCount),
    path: `/banki/${bank.slug}`,
    robots: indexable ? (noindexForSearchParams(searchParams) ?? null) : NOINDEX
  });
}

/** Metadata of a bank that does not exist (or has nothing public): never indexed, no bank name in it. */
export function bankNotFoundMetadata(): Metadata {
  return { title: "Nie znaleziono banku", robots: NOINDEX };
}

/**
 * /promocje/konczace-sie stays `index,follow` also when the list is empty: it
 * is a permanent page of the sitemap (its text and FAQ are the content), and a
 * page that flips between index and noindex with the day's offers would
 * contradict the sitemap, which cannot know the list is empty.
 */
export function endingSoonMetadata(searchParams: SearchParams, now: Date): Metadata {
  return buildMetadata({
    title: { absolute: endingSoonTitle(now) },
    description: ENDING_SOON_DESCRIPTION,
    path: "/promocje/konczace-sie",
    robots: noindexForSearchParams(searchParams) ?? null
  });
}
