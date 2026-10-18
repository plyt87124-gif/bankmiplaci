/**
 * Pure helpers of the /promocje listing (no database, no React): splitting the
 * cards into segments, paging, and the "poluzuj filtr" suggestions. The page
 * (server) feeds them with cards from listPromotionCards; the tests feed them
 * with fixtures.
 */
import { matchesAccountTypeFilter, segmentOf } from "@/lib/accountTypes";
import { ACCOUNT_TYPE_LABEL, DIFFICULTY_LABEL, formatPLN, pluralizePl } from "@/lib/format";
import { PAGE_SIZE, type ListingState } from "@/components/filters/filterParams";

export interface SegmentCountsResult {
  all: number;
  PERSONAL: number;
  BUSINESS: number;
}

/**
 * Counts per segment for cards fetched WITHOUT the account-type filter.
 * "Osobiste" is every non-business type (PERSONAL, SAVINGS, YOUNG, JOINT), so
 * Osobiste + Firmowe always add up to Wszystkie and the count equals what the
 * tab lists (src/lib/accountTypes.ts is the one definition).
 */
export function segmentCounts(cards: readonly { accountType: string }[]): SegmentCountsResult {
  return {
    all: cards.length,
    PERSONAL: cards.filter((card) => segmentOf(card.accountType) === "PERSONAL").length,
    BUSINESS: cards.filter((card) => segmentOf(card.accountType) === "BUSINESS").length
  };
}

/**
 * The account-type filter applied in memory. Equivalent to the database
 * filter (`accountTypeWhere`; the order of the remaining cards is untouched:
 * the "Polecane" score of an offer only depends on offers of its own REAL
 * account type), but it lets one query serve both the list and the Osobiste /
 * Firmowe counts. "PERSONAL" keeps every non-business type, "BUSINESS" only
 * business accounts, "SAVINGS" / "YOUNG" / "JOINT" exactly that type.
 */
export function applyAccountType<T extends { accountType: string }>(cards: readonly T[], accountType: string): T[] {
  return accountType ? cards.filter((card) => matchesAccountTypeFilter(card.accountType, accountType)) : [...cards];
}

export interface PageSlice<T> {
  /** Cards on screen: the first `page` x PAGE_SIZE. */
  visible: T[];
  total: number;
  /** Offers not shown yet. */
  remaining: number;
  /** Page number the "Pokaż więcej" link leads to, null when everything is visible. */
  nextPage: number | null;
}

/**
 * "Pokaż więcej" is cumulative: `?strona=2` shows the first 48 cards, so what
 * was already on screen stays and the list simply grows.
 */
export function slicePage<T>(cards: readonly T[], page: number, pageSize = PAGE_SIZE): PageSlice<T> {
  const safePage = Math.max(1, Math.trunc(page));
  const visible = cards.slice(0, safePage * pageSize);
  const remaining = cards.length - visible.length;
  return { visible, total: cards.length, remaining, nextPage: remaining > 0 ? safePage + 1 : null };
}

/** "Zostało jeszcze 11 promocji" / "Została jeszcze 1 promocja" / "Zostały jeszcze 3 promocje". */
export function remainingText(remaining: number): string {
  const verb = pluralizePl(remaining, "Została", "Zostały", "Zostało");
  const noun = pluralizePl(remaining, "promocja", "promocje", "promocji");
  return `${verb} jeszcze ${remaining} ${noun}`;
}

export interface RelaxationCandidate {
  /** What is removed, e.g. "Trudność: Łatwa, Średnia". */
  label: string;
  /** The change that removes it. */
  patch: Partial<ListingState>;
}

/**
 * One candidate per active filter: removing just that filter. (The sort is not
 * a filter.) The page counts what each one would give and offers the ones that
 * bring offers back.
 */
export function relaxationCandidates(
  state: ListingState,
  banks: readonly { slug: string; name: string }[] = []
): RelaxationCandidate[] {
  const out: RelaxationCandidate[] = [];
  if (state.q) out.push({ label: `Fraza: „${state.q}”`, patch: { q: "" } });
  if (state.accountType) {
    out.push({ label: `Typ konta: ${ACCOUNT_TYPE_LABEL[state.accountType]}`, patch: { accountType: "" } });
  }
  if (state.bank) {
    out.push({ label: `Bank: ${banks.find((bank) => bank.slug === state.bank)?.name ?? state.bank}`, patch: { bank: "" } });
  }
  if (state.difficulty.length) {
    out.push({
      label: `Trudność: ${state.difficulty.map((value) => DIFFICULTY_LABEL[value]).join(", ")}`,
      patch: { difficulty: [] }
    });
  }
  if (state.minBonus) out.push({ label: `Premia od ${formatPLN(state.minBonus)}`, patch: { minBonus: null } });
  if (state.noFees) out.push({ label: "Bez opłaty za konto", patch: { noFees: false } });
  if (state.eligibleOnly) out.push({ label: "Tylko te, w których mogę wziąć udział", patch: { eligibleOnly: false } });
  return out;
}
