/**
 * The ONE source of the affiliate / trust disclosure wording
 * (docs/redesign-v2/04-trust-and-disclosure-plan.md, section 2).
 *
 * Rules:
 *  - No component, page, e-mail or test fixture writes this wording by hand:
 *    they import it from here, so the three claims below can never drift apart.
 *      1. "Polecane" ordering takes the partner remuneration into account.
 *      2. The site rating (ocena serwisu) is computed WITHOUT it.
 *      3. Part of the links are affiliate links.
 *  - The wording needs a lawyer's review before production (UOKiK / unfair
 *    commercial practices, Omnibus - transparency of the main ranking
 *    parameters). It is not legal advice.
 *  - "Ty nie płacisz więcej" is deliberately NOT here: it only enters after the
 *    lawyer's approval, and never for offers that require a code/link.
 *
 * Pure strings, no React and no server-only imports, so server components,
 * client components and unit tests can all use it.
 */

/**
 * Label of the one date line the site shows next to a list or in the footer: the NEWEST
 * `lastVerifiedAt` among the offers on show. It is deliberately not "Dane zaktualizowano" /
 * "Aktualizacja", which suggested that the whole set was checked on that day: single offers can
 * have an older date (each card carries its own). Always rendered with formatDatePL(date, "short")
 * ("7 paź 2026"); the numeric dd.mm.rrrr format is kept for offer deadlines.
 */
export const LATEST_VERIFICATION_LABEL = "Najnowsza weryfikacja oferty";

/** Where the "Jak zarabiamy" / "Jak liczymy" links lead. */
export const DISCLOSURE_LINKS = {
  /** General "how we earn" page. */
  howWeEarn: "/jak-zarabiamy",
  /** Section of that page which explains the "Polecane" ordering. */
  howWeEarnRecommended: "/jak-zarabiamy#polecane",
  /** How the site rating is computed (commission is not a component). */
  methodology: "/metodologia"
} as const;

/** A sentence (or two) of copy followed by one link, rendered as "lead + link". */
export interface DisclosureCopy {
  /** Text before the link; ends with a full stop. */
  lead: string;
  /** Link text, e.g. "Jak zarabiamy". */
  linkLabel: string;
  /** Link target. */
  href: string;
}

/** Plain text of a copy item exactly as a reader sees it ("lead link"). */
export function disclosureText(copy: DisclosureCopy): string {
  return `${copy.lead} ${copy.linkLabel}`;
}

// ---------------------------------------------------------------------------
// Sort keys the disclosure depends on. Mirrors SortKey in services/promotions.ts
// (kept as plain strings so this module stays free of server imports).
// ---------------------------------------------------------------------------

/** "recommended" is also what the listing uses when no `sort` is given at all. */
export function isRecommendedSort(sort: string | null | undefined): boolean {
  return sort == null || sort === "recommended";
}

// ---------------------------------------------------------------------------
// strip - above every list of offers
// ---------------------------------------------------------------------------

export const STRIP_RECOMMENDED: DisclosureCopy = {
  lead: "Część linków to linki partnerskie – możemy otrzymać wynagrodzenie od banku.",
  linkLabel: "Jak zarabiamy",
  href: DISCLOSURE_LINKS.howWeEarnRecommended
};

export const STRIP_OTHER: DisclosureCopy = {
  lead: "Część linków to linki partnerskie – możemy otrzymać wynagrodzenie od banku.",
  linkLabel: "Jak zarabiamy",
  href: DISCLOSURE_LINKS.howWeEarn
};

/** The strip's text for the active sort order. */
export function stripCopy(sort?: string | null): DisclosureCopy {
  return isRecommendedSort(sort) ? STRIP_RECOMMENDED : STRIP_OTHER;
}

// ---------------------------------------------------------------------------
// compact - directly under EVERY button that leads to a bank
// ---------------------------------------------------------------------------

export const COMPACT: DisclosureCopy = {
  lead: "Link partnerski: możemy otrzymać wynagrodzenie od banku.",
  linkLabel: "Jak zarabiamy",
  href: DISCLOSURE_LINKS.howWeEarn
};

/** Text of the outline badge shown next to a bank button in tables. */
export const AFFILIATE_BADGE_LABEL = "Link partnerski";

// ---------------------------------------------------------------------------
// tag - the sort option and the description of the active sort order
// ---------------------------------------------------------------------------

/**
 * Label of the "Polecane" sort option. The suffix is permanent (not "może") and short on purpose:
 * a native <select> cuts long option text on a phone. The full sentence stands right above
 * (strip) and right below (tag description) the control.
 */
export const SORT_RECOMMENDED_LABEL = "Polecane";

/**
 * Description shown under the sort control while "Polecane" is active. The
 * strip above the list already carries the full statement (what the order
 * depends on, that a lower-rated offer can rank higher, that the rating is
 * commission-free), so this line only adds what is new next to the control:
 * that remuneration acts in THIS sort order and in none of the others.
 */
export const TAG_RECOMMENDED_DESCRIPTION: DisclosureCopy = {
  lead: "W tym sortowaniu wynagrodzenie partnerskie wpływa na kolejność. Pozostałe sortowania od niego nie zależą.",
  linkLabel: "Jak zarabiamy",
  href: DISCLOSURE_LINKS.howWeEarnRecommended
};

export const TAG_TOP_RATED: DisclosureCopy = {
  lead: "Ocena serwisu nie uwzględnia prowizji.",
  linkLabel: "Jak liczymy",
  href: DISCLOSURE_LINKS.methodology
};

/**
 * Description of any other order (highest bonus, easiest, newest, ending
 * soon). True by construction: those orders are database orderings on bonus,
 * difficulty + rating, start date or end date (sortToOrderBy in
 * services/promotions.ts) and never read the commission.
 */
export const TAG_OTHER: DisclosureCopy = {
  lead: "Ta kolejność nie zależy od wynagrodzenia partnerskiego.",
  linkLabel: "Jak zarabiamy",
  href: DISCLOSURE_LINKS.howWeEarn
};

/** Description of the active sort order, shown permanently under the sort control. */
export function sortDescriptionCopy(sort?: string | null): DisclosureCopy {
  if (isRecommendedSort(sort)) return TAG_RECOMMENDED_DESCRIPTION;
  if (sort === "top-rated") return TAG_TOP_RATED;
  return TAG_OTHER;
}

// ---------------------------------------------------------------------------
// footer - replaces the former (wrong) "not an official partner of any bank"
// ---------------------------------------------------------------------------

export const FOOTER: DisclosureCopy = {
  lead:
    "Bankmiplaci nie jest bankiem ani oficjalnym przedstawicielem banków. " +
    "Część linków to linki partnerskie – za otwarcie konta przez nasz link możemy otrzymać wynagrodzenie od banku lub sieci partnerskiej. " +
    "Co do zasady nie zmienia to warunków oferty ani naszej oceny; jeśli promocja wymaga otwarcia konta przez link lub kod, sprawdź to w jej warunkach i w regulaminie banku. " +
    "Nazwy i logotypy banków należą do ich właścicieli i służą wyłącznie identyfikacji oferty. " +
    "Nie porównujemy całego rynku. Nie jest to doradztwo finansowe.",
  linkLabel: "Jak zarabiamy",
  href: DISCLOSURE_LINKS.howWeEarn
};

// ---------------------------------------------------------------------------
// Standing notes (plan sections 4 and 5)
// ---------------------------------------------------------------------------

/** Permanent line on an offer page. */
export const NOT_BANK_NOTE = "Nie jesteśmy bankiem ani doradcą. Warunki ustala bank.";

/** Scope of the comparison; shown on /promocje, /porownaj and the hubs. */
export const MARKET_SCOPE_NOTE: DisclosureCopy = {
  lead: "Nie obejmujemy całego rynku – pokazujemy promocje, które przeanalizowaliśmy. To nie jest doradztwo finansowe.",
  linkLabel: "Jak liczymy ocenę",
  href: DISCLOSURE_LINKS.methodology
};

/** Under the comment form and list. */
export const COMMENTS_NOTE = "Opinie użytkowników – nie weryfikujemy ich. Nie stanowią porady.";

/** Next to the rating, ALWAYS (not only when a rating reason exists). */
export const RATING_NOTE = "Ocena serwisu, nie porada finansowa.";

/** The principle behind the rating; also guarded by tests of the rating code. */
export const RATING_COMMISSION_RULE = "Wysokość prowizji nie jest składnikiem oceny.";

/** Shown when `requiresReferralLink` is true (never when it is null/false). */
export const REQUIRES_REFERRAL_NOTICE = "Ta promocja wymaga otwarcia konta przez link lub kod";
