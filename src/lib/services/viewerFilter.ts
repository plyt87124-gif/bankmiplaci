import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listEligibilityMarks } from "@/lib/services/blockedPromotions";
import { getCurrentUser } from "@/lib/userSession";

export interface ViewerExclusions {
  /** The signed-in visitor turned on "Pokazuj tylko oferty, w których mogę wziąć udział" in Moje konto. */
  enabled: boolean;
  /** Slugs hidden from every list for this visitor (current client, karencja, ściąga already open). */
  excluded: ReadonlySet<string>;
}

const NONE: ViewerExclusions = { enabled: false, excluded: new Set() };

/**
 * Per request: which offers this visitor chose not to see. Anonymous visitors, visitors without the setting, a
 * missing request context (tests, scripts) and any failure all mean "nothing excluded" - a list never breaks
 * because of this.
 */
export const getViewerExclusions = cache(async (): Promise<ViewerExclusions> => {
  try {
    const user = await getCurrentUser();
    if (!user?.onlyEligible) return NONE;
    const marks = await listEligibilityMarks(user.id);
    return { enabled: true, excluded: new Set(marks.map((m) => m.slug)) };
  } catch {
    return NONE;
  }
});

/**
 * Is an admin signed in to the panel in this browser? Then admin-only offers
 * (Promotion.adminOnly) are listed too, whichever visitor account is active.
 * No request context (build, scripts, sitemap) or any failure = false.
 */
export const viewerIsAdmin = cache(async (): Promise<boolean> => {
  try {
    return Boolean(await getServerSession(authOptions));
  } catch {
    return false;
  }
});

/** Removes the offers the visitor chose to hide; returns the list unchanged when they did not. */
export async function applyViewerExclusions<T extends { slug: string }>(cards: T[]): Promise<T[]> {
  const { excluded } = await getViewerExclusions();
  return excluded.size === 0 ? cards : cards.filter((card) => !excluded.has(card.slug));
}
