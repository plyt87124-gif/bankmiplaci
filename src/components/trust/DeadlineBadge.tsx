import { CalendarDays, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { deadlineState } from "@/lib/freshness";

/**
 * Deadline of an offer as a Badge: "Ważna do 31.10.2026" (neutral),
 * "Koniec za 5 dni" (warning, <= 14 days), "Koniec za 2 dni" / "Koniec dziś"
 * (red, <= 3 days), "Zakończona" (red). Server component, static, no
 * countdown and no urgency copy. Renders nothing when there is no usable
 * `endDate` (it never invents a deadline).
 *
 * `endDate` = the LAST day the offer can be joined (00:00 UTC of that date,
 * as stored); days are counted on Poland's calendar. `now` is injectable for
 * tests. `detailed` adds the missing half: the date to "Koniec za N dni",
 * the days left to "Ważna do ..." (offer header / aside).
 *
 * `plain` drops the chip: an icon and a line of text, tinted only when the
 * deadline is near (warn) or very near (red). Cards use it: a grey chip around
 * a date that is nothing special only adds noise.
 */
export function DeadlineBadge({
  endDate,
  now,
  detailed = false,
  plain = false,
  className
}: {
  endDate: Date | string | null | undefined;
  now?: Date;
  detailed?: boolean;
  plain?: boolean;
  className?: string;
}) {
  const info = deadlineState(endDate, now);
  if (info.state === "unknown") return null;

  const text = detailed ? info.detailedLabel : info.label;
  const variant = info.state === "ended" || info.state === "urgent" ? "danger" : info.state === "soon" ? "warn" : "neutral";

  if (plain) {
    const Icon = info.state === "ended" ? XCircle : info.state === "urgent" || info.state === "soon" ? Clock : CalendarDays;
    return (
      <p
        className={cn(
          "flex items-center gap-1.5 text-small",
          info.state === "ended" || info.state === "urgent"
            ? "font-semibold text-coral-600"
            : info.state === "soon"
              ? "font-semibold text-warn"
              : "text-ink-700",
          className
        )}
      >
        <Icon size={16} aria-hidden="true" className="shrink-0" />
        <span data-deadline={info.state}>{text}</span>
      </p>
    );
  }

  return (
    <Badge
      variant={variant}
      icon={info.state === "ended" ? XCircle : info.state === "urgent" ? Clock : undefined}
      className={className}
    >
      <span data-deadline={info.state}>{text}</span>
    </Badge>
  );
}
