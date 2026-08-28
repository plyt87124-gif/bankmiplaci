"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle, UserPlus, MousePointerClick, Clock } from "lucide-react";
import { formatDate } from "@/lib/format";

type NotificationType = "NEW_COMMENT" | "ELIGIBILITY_CLEARED" | "NEW_USER" | "PROMOTION_CLICK";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
}

const TYPE_ICON: Record<NotificationType, typeof MessageCircle> = {
  NEW_COMMENT: MessageCircle,
  ELIGIBILITY_CLEARED: Clock,
  NEW_USER: UserPlus,
  PROMOTION_CLICK: MousePointerClick
};

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    // No ?type= filter — every notification type (comments, karencja,
    // nowe konta, kliknięcia "Przejdź do promocji") shows in one feed.
    const res = await fetch("/api/admin/notifications");
    const data = await res.json().catch(() => null);
    setItems(data?.notifications ?? []);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close when clicking anywhere outside the bell/panel.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100"
        aria-label="Powiadomienia o aktywności"
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-coral-600 text-[10px] font-medium text-white">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl2 border border-ink-100 bg-surface p-2 shadow-cardHover">
          <p className="px-2 py-1.5 text-xs font-semibold text-ink-500">Aktywność na stronie</p>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-ink-500">Brak nowych powiadomień.</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-ink-100"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    <div>
                      <p className="text-xs font-medium text-ink-900">{n.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-ink-300">{formatDate(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-lg px-2 py-2 text-center text-xs font-medium text-teal-700 hover:bg-ink-100"
          >
            Przejdź do panelu administracyjnego
          </Link>
        </div>
      )}
    </div>
  );
}
