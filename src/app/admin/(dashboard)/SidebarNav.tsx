"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Tag, Landmark, Users, MessageCircle, CalendarClock, BarChart3 } from "lucide-react";

type BadgeType = "NEW_COMMENT" | "NEW_USER" | "ELIGIBILITY_CLEARED";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeType?: BadgeType;
}

// Defined here (not passed down as a prop from the server layout) because
// icon components are functions — Next.js can't serialize a function
// across the server/client boundary, so this list has to live inside the
// client component that actually renders it.
const NAV: NavItem[] = [
  { href: "/admin", label: "Pulpit", icon: LayoutDashboard },
  { href: "/admin/statystyki", label: "Statystyki", icon: BarChart3 },
  { href: "/admin/promocje", label: "Promocje", icon: Tag },
  { href: "/admin/banki", label: "Banki", icon: Landmark },
  { href: "/admin/uzytkownicy", label: "Użytkownicy", icon: Users, badgeType: "NEW_USER" },
  { href: "/admin/komentarze", label: "Komentarze", icon: MessageCircle, badgeType: "NEW_COMMENT" },
  {
    href: "/admin/przypomnienia-karencja",
    label: "Przypomnienia (karencja)",
    icon: CalendarClock,
    badgeType: "ELIGIBILITY_CLEARED"
  }
];

/**
 * Left admin menu. Three items carry a small unread-count badge instead
 * of their own bell in the header (see layout.tsx) — the badge clears
 * once the admin actually visits that page (MarkNotificationsSeen).
 */
export function SidebarNav() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/notifications/counts");
      const data = await res.json().catch(() => null);
      setCounts(data?.counts ?? {});
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="mt-8 space-y-1">
      {NAV.map((item) => {
        const count = item.badgeType ? counts[item.badgeType] ?? 0 : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {count > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-600 px-1 text-[10px] font-medium text-white">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
