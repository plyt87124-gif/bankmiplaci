/**
 * The bookkeeping behind `useCommittedValue` (see there for the why), kept free
 * of React so it can be unit-tested with fake timers.
 *
 *  - `set(value)` writes the value to the outside world (`commit`) after
 *    `delay` ms without another `set`; `set(value, true)` writes at once.
 *  - `sync(external)` is called whenever the outside value (the URL) changed.
 *    It answers `{ follow }` when the change came from somewhere else and the
 *    control has to show it, or `null` when it is just the echo of one of our
 *    own commits (or nothing changed): a slow server answer must never
 *    overwrite what the user typed in the meantime.
 */
export interface CommitterOptions<T> {
  commit: (value: T) => void;
  /** Whether two values count as the same (default `Object.is`). */
  equals?: (a: T, b: T) => boolean;
  /** Milliseconds without a new `set` before the commit; <= 0 commits at once. */
  delay: number;
}

export interface Committer<T> {
  set(value: T, immediate?: boolean): void;
  sync(external: T): { follow: T } | null;
  /** Cancels a pending commit (unmount). The committer stays usable afterwards. */
  dispose(): void;
}

/** How many commits whose echo has not arrived yet are remembered. */
const MAX_AWAITING = 10;

/**
 * `options` is read on every call, so a caller may hand over fresh closures on
 * each render (`() => latest`) without recreating the committer.
 */
export function createCommitter<T>(initial: T, options: () => CommitterOptions<T>): Committer<T> {
  let seen = initial;
  let awaiting: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const same = (a: T, b: T) => (options().equals ?? Object.is)(a, b);

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return {
    set(value, immediate = false) {
      cancel();
      const { commit, delay } = options();
      const run = () => {
        timer = null;
        if (!same(value, seen)) awaiting = [...awaiting.slice(-(MAX_AWAITING - 1)), value];
        commit(value);
      };
      if (immediate || delay <= 0) run();
      else timer = setTimeout(run, delay);
    },

    sync(external) {
      if (same(external, seen)) return null;
      seen = external;
      const echo = awaiting.findIndex((value) => same(value, external));
      if (echo !== -1) {
        awaiting = awaiting.slice(echo + 1);
        return null;
      }
      // Changed from outside: drop the pending commit and follow it.
      cancel();
      awaiting = [];
      return { follow: external };
    },

    dispose: cancel
  };
}
