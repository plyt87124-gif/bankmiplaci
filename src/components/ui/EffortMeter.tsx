import { cn } from "@/lib/cn";

/**
 * The site's signature element (see brief §40/§41): lets a user compare
 * "700 zł / łatwa" against "900 zł / trudna" at a glance, instead of
 * ranking promotions on bonus size alone.
 */
export function EffortMeter({ level, className }: { level: 1 | 2 | 3 | 4 | 5; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-1.5 w-24 gap-0.5" role="img" aria-label={`Wysiłek: ${level}/5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn("h-full flex-1 rounded-full", i <= level ? "bg-ink-900" : "bg-ink-100")}
          />
        ))}
      </div>
      <span className="font-mono text-xs text-ink-500">Wysiłek {level}/5</span>
    </div>
  );
}
