"use client";

import { useEffect } from "react";

/**
 * Mounted on the three admin pages whose notification type is surfaced as
 * a sidebar badge instead of its own bell (Komentarze, Użytkownicy,
 * Przypomnienia karencja — see layout.tsx / SidebarNav.tsx). Visiting the
 * page IS the acknowledgment: it marks every unread notification of that
 * type as read, so the badge clears once the admin has actually looked.
 */
export function MarkNotificationsSeen({ type }: { type: "NEW_COMMENT" | "NEW_USER" | "ELIGIBILITY_CLEARED" }) {
  useEffect(() => {
    fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllType: type })
    }).catch(() => {
      // Never let this affect the page itself.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return null;
}
