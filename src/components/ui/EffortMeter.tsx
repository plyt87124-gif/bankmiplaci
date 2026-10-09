import type { Difficulty } from "@prisma/client";
import { cn } from "@/lib/cn";
import { DIFFICULTY_LEVEL } from "@/lib/format";

/**
 * Difficulty meter, the site's signature element: 4 segments mapped 1:1 to
 * the four Difficulty values (Bardzo łatwa / Łatwa / Średnia / Trudna), so
 * "700 zł, łatwa" can be compared with "900 zł, trudna" at a glance.
 * Deliberately NEUTRAL (ink, no teal/gold/coral): a hard promotion is not an
 * error. Filled = ink-900, empty = ink-100 (hairline ring in the dark theme).
 *
 * Pass `difficulty` (preferred) or a numeric `level`. The old 1-5 `level`
 * (HARD = 5) is still accepted and clamped to 4 for not-yet-migrated callers.
 */
const LEVEL_LABELS = ["Bardzo łatwa", "Łatwa", "Średnia", "Trudna"] as const;

type Level = 1 | 2 | 3 | 4;

function toLevel(value: number): Level {
  const rounded = Math.round(value);
  return (rounded <= 1 ? 1 : rounded >= 4 ? 4 : rounded) as Level;
}

export function EffortMeter({
  difficulty,
  level,
  showLabel = true,
  className
}: {
  difficulty?: Difficulty;
  level?: number;
  /** Show the word next to the segments (default). Hide only where the word sits elsewhere. */
  showLabel?: boolean;
  className?: string;
}) {
  const resolved = toLevel(difficulty ? DIFFICULTY_LEVEL[difficulty] : (level ?? 1));
  const label = LEVEL_LABELS[resolved - 1] ?? LEVEL_LABELS[0];

  return (
    <span
      role="img"
      aria-label={`Trudność: ${label.toLowerCase()}, ${resolved} z 4`}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span aria-hidden="true" className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-4 rounded-[2px]",
              i <= resolved ? "bg-ink-900" : "bg-ink-100 dark:ring-1 dark:ring-inset dark:ring-line"
            )}
          />
        ))}
      </span>
      {showLabel ? (
        <span aria-hidden="true" className="text-small font-semibold text-ink-700">
          {label}
        </span>
      ) : null}
    </span>
  );
}
