import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { describeFreshness } from "@/lib/freshness";

/**
 * "Zweryfikowano 6 paź 2026" - the verification line of cards and offer pages.
 * Server component, static (no animation: motion must not suggest more trust
 * than the data gives). Comes ONLY from `lastVerifiedAt`:
 *   <= 14 days   shield-check in the action colour
 *   15-45 days   shield-check in a quieter ink
 *   > 45 days    "... - dane mogą być nieaktualne" (question-mark shield)
 *   no date      "Brak daty weryfikacji" with a question-mark shield (never a check)
 * The words carry the meaning; the colour of the icon is only a hint.
 *
 * `now` is injectable for tests; leave it out in pages. NB: when a page is
 * statically cached, the day count is the one at render time.
 * `badge` renders the same information as a Badge (offer header).
 */
export function VerifiedLine({
  lastVerifiedAt,
  now,
  badge = false,
  className
}: {
  lastVerifiedAt: Date | string | null | undefined;
  now?: Date;
  badge?: boolean;
  className?: string;
}) {
  const info = describeFreshness(lastVerifiedAt, now);
  const Icon = info.state === "unknown" || info.state === "stale" ? ShieldQuestion : ShieldCheck;

  const content = (
    <>
      {info.state === "unknown" ? (
        info.text
      ) : (
        <>
          {info.prefix} <time dateTime={info.iso ?? undefined}>{info.dateText}</time>
          {info.suffix ? ` – ${info.suffix}` : null}
        </>
      )}
    </>
  );

  if (badge) {
    return (
      <span data-freshness={info.state} className={className}>
        <Badge
          variant={info.state === "fresh" ? "verified" : "neutral"}
          icon={Icon}
          className="h-auto min-h-6 whitespace-normal py-1"
        >
          {content}
        </Badge>
      </span>
    );
  }

  return (
    <p data-freshness={info.state} className={cn("flex items-center gap-1.5 text-small text-ink-500", className)}>
      <Icon
        size={16}
        aria-hidden="true"
        className={cn("shrink-0", info.state === "fresh" ? "text-action" : "text-ink-400")}
      />
      <span>{content}</span>
    </p>
  );
}
