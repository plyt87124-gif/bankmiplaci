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

/**
 * Resolves when `find` returns something (polled with timers) or after `timeoutMs`.
 *
 * Timers on purpose, NOT requestAnimationFrame: while a view transition waits for its update callback the browser
 * suppresses rendering, so rAF callbacks do not run - waiting on them would hang until the browser gives up on the
 * transition after ~4 s (no animation, a frozen page, and a click that "takes 3 seconds").
 */
export function waitFor<T>(find: () => T | null, timeoutMs = 2500): Promise<T | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      const found = find();
      if (found || performance.now() - started > timeoutMs) {
        // a short beat, so the new page has really been laid out
        window.setTimeout(() => resolve(found), 60);
        return;
      }
      window.setTimeout(tick, 16);
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

/**
 * Card -> offer page. `navigate` is called INSIDE the transition callback, i.e. only after the browser has taken the
 * picture of the old page; starting the navigation earlier lets a prefetched page replace the DOM before that picture
 * and the animation silently disappears.
 */
export function morphForward(card: HTMLElement, navigate: () => void): void {
  const doc = document as TransitionDoc;
  nameCard(card);
  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    navigate();
  };
  // Safety net: a tab that is not painting frames (hidden, throttled) never runs the callback; the click must still work.
  const fallback = window.setTimeout(go, 500);
  try {
    const transition = doc.startViewTransition!(async () => {
      window.clearTimeout(fallback);
      go();
      await waitFor(() => document.querySelector(`[data-vt-dest="${VT_CARD}"]`), 4000);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    });
    whenDone(transition, () => clearCard(card));
  } catch {
    window.clearTimeout(fallback);
    clearCard(card);
    go();
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
