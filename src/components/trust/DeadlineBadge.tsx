import { Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
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
 */
export function DeadlineBadge({
  endDate,
  now,
  detailed = false,
  className
}: {
  endDate: Date | string | null | undefined;
  now?: Date;
  detailed?: boolean;
  className?: string;
}) {
  const info = deadlineState(endDate, now);
  if (info.state === "unknown") return null;

  const text = detailed ? info.detailedLabel : info.label;
  const variant = info.state === "ended" || info.state === "urgent" ? "danger" : info.state === "soon" ? "warn" : "neutral";

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
