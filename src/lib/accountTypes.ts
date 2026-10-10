/**
 * ONE definition of "konta osobiste" and "konta firmowe" for the whole public
 * site. The database knows five account types (Prisma `AccountType`); readers
 * know two kinds of account. Every place that says "osobiste" / "firmowe" -
 * the Osobiste | Firmowe tabs and their counters on /promocje, the home page
 * segments, the two hubs, /porownaj, the quiz, the database filter behind
 * `?accountType=` - goes through this module, so the numbers cannot drift
 * apart ("Osobiste (14)" on one page and "(16)" on another).
 *
 *   BUSINESS                          -> firmowe
 *   PERSONAL, SAVINGS, YOUNG, JOINT   -> osobiste (everything that is not business)
 *
 * What this module deliberately does NOT do: it never rewrites the real
 * account type of an offer. The badge on a card ("Konto dla młodych"), the
 * page of an offer, its structured data and the "Polecane" order (the partner
 * remuneration is compared inside the offer's REAL account type, see
 * lib/recommended.ts) keep reading `accountType` as it is stored.
 *
 * Pure and dependency-free at runtime (type imports only), so client
 * components (filters) can import it too.
 */
import type { AccountType, Prisma } from "@prisma/client";

/** The two kinds of account a reader chooses between. */
export type AccountSegment = "PERSONAL" | "BUSINESS";

/** Order of the segments wherever both are offered. */
export const ACCOUNT_SEGMENTS: readonly AccountSegment[] = ["PERSONAL", "BUSINESS"];

/**
 * Every AccountType and the segment it belongs to. `satisfies Record<AccountType, ...>`
 * makes a new value in schema.prisma a compile error here until somebody
 * decides which side it is on.
 */
const SEGMENT_OF_TYPE = {
  PERSONAL: "PERSONAL",
  SAVINGS: "PERSONAL",
  YOUNG: "PERSONAL",
  JOINT: "PERSONAL",
  BUSINESS: "BUSINESS"
} as const satisfies Record<AccountType, AccountSegment>;

/** Account types counted as "osobiste". */
export const PERSONAL_ACCOUNT_TYPES: readonly AccountType[] = (
  Object.keys(SEGMENT_OF_TYPE) as AccountType[]
).filter((type) => SEGMENT_OF_TYPE[type] === "PERSONAL");

/** Account types counted as "firmowe". */
export const BUSINESS_ACCOUNT_TYPES: readonly AccountType[] = (
  Object.keys(SEGMENT_OF_TYPE) as AccountType[]
).filter((type) => SEGMENT_OF_TYPE[type] === "BUSINESS");

/** Every account type the database can hold. */
export const ALL_ACCOUNT_TYPES: readonly AccountType[] = Object.keys(SEGMENT_OF_TYPE) as AccountType[];

/** Account types of one segment. */
export function accountTypesOf(segment: AccountSegment): readonly AccountType[] {
  return segment === "BUSINESS" ? BUSINESS_ACCOUNT_TYPES : PERSONAL_ACCOUNT_TYPES;
}

/**
 * The segment of an account type. An unknown or empty value counts as
 * "osobiste": only BUSINESS is ever "firmowe" (the long-standing rule of
 * /porownaj, the hubs and the sitemap).
 */
export function segmentOf(accountType: string | null | undefined): AccountSegment {
  return accountType === "BUSINESS" ? "BUSINESS" : "PERSONAL";
}

export function isBusinessType(accountType: string | null | undefined): boolean {
  return segmentOf(accountType) === "BUSINESS";
}

export function isPersonalType(accountType: string | null | undefined): boolean {
  return segmentOf(accountType) === "PERSONAL";
}

/** `PERSONAL` or `BUSINESS` as a segment, anything else (including "") is not one. */
export function isAccountSegment(value: string | null | undefined): value is AccountSegment {
  return value === "PERSONAL" || value === "BUSINESS";
}

/**
 * Does an offer of `accountType` pass the `accountType` filter of the listing?
 *   ""                       every offer
 *   "PERSONAL" / "BUSINESS"  the SEGMENT (PERSONAL = all non-business types)
 *   SAVINGS, YOUNG, JOINT    exactly that type (an old link; the chip says so)
 * The same rule as `accountTypeWhere`, applied in memory.
 */
export function matchesAccountTypeFilter(accountType: string, filter: string): boolean {
  if (!filter) return true;
  if (isAccountSegment(filter)) return segmentOf(accountType) === filter;
  return accountType === filter;
}

/**
 * The Prisma `where` fragment for the same filter (`{}` for no filter). The
 * SEGMENT PERSONAL becomes `in (PERSONAL, SAVINGS, YOUNG, JOINT)`, so a database
 * count and the in-memory split of `matchesAccountTypeFilter` always agree.
 * A value that is not an account type is passed through unchanged (callers
 * whitelist it first: parseListingParams).
 */
export function accountTypeWhere(filter: string | null | undefined): Pick<Prisma.PromotionWhereInput, "accountType"> {
  if (!filter) return {};
  if (filter === "PERSONAL") return { accountType: { in: [...PERSONAL_ACCOUNT_TYPES] } };
  return { accountType: filter as AccountType };
}
