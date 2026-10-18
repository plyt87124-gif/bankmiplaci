/**
 * Definitions of terms that more than one page explains. One constant per term, imported by the
 * pages (FAQ, home shortcut, /promocje FAQ, /jak-to-dziala), so the same word is never defined in
 * two different ways. Plain strings: no React, no server-only imports.
 *
 * The offer page (components/promocja/offerModel.ts) reuses KARENCJA_DEFINITION as COOLDOWN_EXPLAINER.
 */

/**
 * "Karencja". The eligibility code supports both ways of counting it: from the date the user closed
 * the account (cooldown in months) and from a fixed cut-off date set by the promotion's regulations
 * (see lib/services/eligibility.ts), which is why both appear here.
 */
export const KARENCJA_DEFINITION =
  "Karencja to okres wymagany przez regulamin promocji, w którym bank nie uznaje Cię za nowego klienta – liczony od daty zamknięcia konta albo od stałej daty podanej w regulaminie. Sposób liczenia zawsze podaje regulamin promocji.";
