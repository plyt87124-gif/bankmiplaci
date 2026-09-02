"use client";

import { useActivityTier, type ActivityTier } from "./ActivityProvider";

const TIER_STYLE: Record<Exclude<ActivityTier, "never">, { dot: string; ring: string; label: string }> = {
  online: { dot: "bg-green-500", ring: "bg-green-400", label: "Online teraz (aktywność w ciągu ostatnich 5 minut)" },
  today: { dot: "bg-lime-500", ring: "bg-lime-400", label: "Był/a na stronie w ciągu ostatnich 24 godzin" },
  week: { dot: "bg-orange-500", ring: "bg-orange-400", label: "Był/a na stronie 1–7 dni temu" },
  month: { dot: "bg-orange-700", ring: "bg-orange-600", label: "Był/a na stronie 7–30 dni temu" },
  old: { dot: "bg-red-500", ring: "bg-red-400", label: "Nie widziano od ponad miesiąca" }
};

export function ActivityDot({ userId }: { userId: string }) {
  const tier = useActivityTier(userId);

  if (tier === "never") return null;

  const { dot, ring, label } = TIER_STYLE[tier];
  const isOnline = tier === "online";

  return (
    <span className="relative flex h-2.5 w-2.5" title={label}>
      {/* Pulsing ring only for "truly online right now" — every other tier
          is a static color-coded recency badge, not a live presence claim. */}
      {isOnline && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${ring}`} />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
    </span>
  );
}
