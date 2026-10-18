/**
 * Browser-only helpers of the "card becomes the offer page" transition (View
 * Transitions API). The elements of an offer card carry `data-vt="logo|title|..."`;
 * the matching elements of the offer page carry the same names as
 * `view-transition-name: vt-<name>` all the time. Only the card that was clicked
 * gets its names set (names must be unique on a page), so the browser flies each
 * piece of the card to its place on the page; the reverse works the same way.
 *
 * Everything degrades to a normal navigation: no API, reduced motion, or any
 * failure means the page simply changes without the effect.
 */

interface ViewTransitionLike {
  finished: Promise<void>;
  ready?: Promise<void>;
  updateCallbackDone?: Promise<void>;
}

type TransitionDoc = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike;
};

/** Runs `after` when the transition is over and swallows the rejections of a skipped one (a new navigation, a hidden tab). */
function whenDone(transition: ViewTransitionLike, after: () => void): void {
  transition.ready?.catch(() => {});
  transition.updateCallbackDone?.catch(() => {});
  transition.finished.then(after, after);
}

export const VT_CARD = "card";
export const LAST_CARD_KEY = "bmp-last-card";

export function canMorph(): boolean {
  try {
    return (
      typeof (document as TransitionDoc).startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

/** Gives the card and its tagged parts their transition names (only one card at a time). */
export function nameCard(card: Element | null): void {
  if (!card) return;
  (card as HTMLElement).style.viewTransitionName = `vt-${VT_CARD}`;
  card.querySelectorAll<HTMLElement>("[data-vt]").forEach((el) => {
    el.style.viewTransitionName = `vt-${el.dataset.vt}`;
  });
}

export function clearCard(card: Element | null): void {
  if (!card) return;
  (card as HTMLElement).style.viewTransitionName = "";
  card.querySelectorAll<HTMLElement>("[data-vt]").forEach((el) => {
    el.style.viewTransitionName = "";
  });
}

/** Resolves when `find` returns something (checked every frame) or after `timeoutMs`. */
export function waitFor<T>(find: () => T | null, timeoutMs = 2500): Promise<T | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      const found = find();
      if (found || performance.now() - started > timeoutMs) {
        // one more frame, so the new page has really been laid out
        requestAnimationFrame(() => resolve(found));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** The visible card of an offer in the current page (the carousel keeps hidden copies). */
export function findVisibleCard(slug: string): HTMLElement | null {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-vt="${VT_CARD}"][data-slug="${CSS.escape(slug)}"]`)
  );
  return cards.find((el) => el.getBoundingClientRect().width > 0 && !el.closest("[inert]")) ?? null;
}

/** Card -> offer page. The caller's link starts the (client-side) navigation; this waits for the new page. */
export function morphForward(card: HTMLElement): void {
  const doc = document as TransitionDoc;
  nameCard(card);
  try {
    const transition = doc.startViewTransition!(async () => {
      await waitFor(() => document.querySelector(`[data-vt-dest="${VT_CARD}"]`));
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    });
    whenDone(transition, () => clearCard(card));
  } catch {
    clearCard(card);
  }
}

/** Offer page -> the card of the same offer in the list that is shown again. */
export function morphBack(slug: string): void {
  const doc = document as TransitionDoc;
  let named: HTMLElement | null = null;
  try {
    const transition = doc.startViewTransition!(async () => {
      named = await waitFor(() => findVisibleCard(slug), 1800);
      if (named) {
        const rect = named.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          named.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        }
        nameCard(named);
      }
    });
    whenDone(transition, () => clearCard(named));
  } catch {
    // nothing to undo: the navigation itself is not ours
  }
}
