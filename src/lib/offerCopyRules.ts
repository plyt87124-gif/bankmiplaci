/**
 * Copy rules for offer pages: sentences that must NEVER appear in a promotion's text.
 *
 * Owner decision, 2026-11-07: two boilerplate sentences were removed from every offer page
 * because they say what the page already says elsewhere and only add length:
 *
 *  1. under "Warunki promocji … krok po kroku": "Lista może zawierać także dodatkowe zasady i
 *     ograniczenia, a nie tylko czynności do wykonania."
 *  2. under "Składniki premii": "Premia maksymalna nie jest gwarantowana – otrzymasz ją tylko po
 *     spełnieniu wszystkich warunków cząstkowych opisanych wyżej."
 *
 * The page templates no longer print them. This file keeps them out of the DATA as well, because
 * promotions are generated (candidate files written from a bank's regulation) and a generator can
 * easily paste the same boilerplate into `summary`, a condition or a part label. It is checked:
 *  - by the bulk import (`importPromotions`, phase 1: a hit aborts the whole run before any write),
 *  - by the admin form (the fields the form shows errors for),
 *  - by tests/offer-copy-rules.test.ts, which also scans `src/` and the candidate files.
 *
 * The OTHER half of the same rule is not machine-checkable and is written in CLAUDE.md ("Treść
 * ofert"): say each thing once. Karencja belongs in `cooldownMonths` / `cooldownCutoffDate`, who may
 * and may not join in `eligibleFor` / `notEligibleFor`, and none of them repeats the others.
 */

export interface OfferCopyInput {
  eligibleFor?: string | null;
  notEligibleFor?: string | null;
  summary?: string | null;
  description?: string | null;
  conditions?: readonly { title?: string | null; description?: string | null }[] | null;
  bonusParts?: readonly { label?: string | null }[] | null;
}

export interface OfferCopyIssue {
  path: (string | number)[];
  message: string;
}

/** Whitespace-tolerant, diacritics-tolerant: a copy typed without Polish letters must be caught too. */
export const BANNED_OFFER_SENTENCES: readonly { id: string; pattern: RegExp; sentence: string }[] = [
  {
    id: "steps-and-rules",
    pattern: /lista\s+mo[żz]e\s+zawiera[ćc]\s+tak[żz]e\s+dodatkowe\s+zasady\s+i\s+ograniczenia/i,
    sentence: "Lista może zawierać także dodatkowe zasady i ograniczenia, a nie tylko czynności do wykonania."
  },
  {
    id: "max-bonus-not-guaranteed",
    pattern: /premia\s+maksymalna\s+nie\s+jest\s+gwarantowana/i,
    sentence:
      "Premia maksymalna nie jest gwarantowana – otrzymasz ją tylko po spełnieniu wszystkich warunków cząstkowych opisanych wyżej."
  },
  {
    id: "all-partial-conditions",
    pattern: /warunk[óo]w\s+cz[ąa]stkowych\s+opisanych\s+wy[żz]ej/i,
    sentence: "…wszystkich warunków cząstkowych opisanych wyżej."
  }
];

/** The banned sentence found in `text`, or null. */
export function bannedSentenceIn(text: string | null | undefined): (typeof BANNED_OFFER_SENTENCES)[number] | null {
  if (!text) return null;
  return BANNED_OFFER_SENTENCES.find((banned) => banned.pattern.test(text)) ?? null;
}

function issue(path: (string | number)[], banned: (typeof BANNED_OFFER_SENTENCES)[number]): OfferCopyIssue {
  return {
    path,
    message: `Usuń zdanie „${banned.sentence}” – właściciel zdecydował, że nie ma go na stronach ofert (src/lib/offerCopyRules.ts).`
  };
}

/** Every banned sentence in the free-text fields of one promotion, with the path of the field it sits in. */
export function offerCopyIssues(input: OfferCopyInput): OfferCopyIssue[] {
  const issues: OfferCopyIssue[] = [];
  const check = (path: (string | number)[], text: string | null | undefined) => {
    const banned = bannedSentenceIn(text);
    if (banned) issues.push(issue(path, banned));
  };
  check(["eligibleFor"], input.eligibleFor);
  check(["notEligibleFor"], input.notEligibleFor);
  check(["summary"], input.summary);
  check(["description"], input.description);
  input.conditions?.forEach((condition, index) => {
    check(["conditions", index, "title"], condition.title);
    check(["conditions", index, "description"], condition.description);
  });
  input.bonusParts?.forEach((part, index) => check(["bonusParts", index, "label"], part.label));
  return issues;
}

/** The same issues as one line each, for an importer's problem list: `slug: field.path: message`. */
export function offerCopyProblems(slug: string, input: OfferCopyInput): string[] {
  return offerCopyIssues(input).map((found) => `${slug}: ${found.path.join(".")}: ${found.message}`);
}
