"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createCommitter, type Committer } from "@/components/filters/committer";

/**
 * A control whose value lives in the URL but must feel instant:
 *
 *  - `draft` is what the control shows RIGHT NOW (typed text, the segment the
 *    arrow keys just moved to);
 *  - `set(value)` updates the draft immediately and calls `commit(value)` after
 *    `delay` ms without further changes, so typing or arrowing through a
 *    segment writes the URL once, not on every key press. `set(value, true)`
 *    (or `delay: 0`) commits at once;
 *  - when `external` (the value in the URL) changes for any OTHER reason - a
 *    chip was removed, "Wyczyść" was pressed, the Back button - the draft
 *    follows it. The URL's echo of our own commits is recognised (we remember
 *    what we committed) and ignored, so a slow server answer can never
 *    overwrite text typed in the meantime.
 *
 * `commit` may change identity on every render: the latest one is used.
 * `equals` says when two values count as the same (default `Object.is`); the
 * search box passes a comparison that ignores surrounding spaces, so the URL's
 * trimmed echo of "mbank " does not eat the space the user just typed.
 * The bookkeeping itself is in committer.ts (unit-tested).
 */
export function useCommittedValue<T>(
  external: T,
  commit: (value: T) => void,
  delay: number,
  equals: (a: T, b: T) => boolean = Object.is
): readonly [T, (value: T, immediate?: boolean) => void] {
  const [draft, setDraft] = useState(external);
  const latest = useRef({ commit, equals, delay });
  const committer = useRef<Committer<T> | null>(null);
  if (committer.current === null) {
    committer.current = createCommitter(external, () => latest.current);
  }

  useEffect(() => {
    latest.current = { commit, equals, delay };
  });

  useEffect(() => {
    const result = committer.current?.sync(external);
    if (result) setDraft(result.follow);
  }, [external]);

  useEffect(
    () => () => {
      committer.current?.dispose();
    },
    []
  );

  const set = useCallback((value: T, immediate = false) => {
    setDraft(value);
    committer.current?.set(value, immediate);
  }, []);

  return [draft, set] as const;
}
