import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminProviders } from "./AdminProviders";
import { LayoutDashboard, Tag, Landmark, Users, MessageCircle, CalendarClock, BarChart3, Eye, MousePointerClick } from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";
import { SidebarNav, type NavItem } from "./SidebarNav";

export const metadata = { robots: { index: false, follow: false } };

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

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/logowanie");

  return (
    <AdminProviders>
      <div className="flex min-h-screen bg-paper">
        <aside className="hidden w-64 shrink-0 border-r border-ink-100 bg-surface p-5 md:block">
          <p className="font-display text-lg font-semibold">Bankmiplaci — Admin</p>
          <SidebarNav items={NAV} />
          <div className="mt-10 border-t border-ink-100 pt-4">
            <p className="text-xs text-ink-500">{session.user?.email}</p>
            <SignOutButton />
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex h-14 items-center justify-end gap-2 border-b border-ink-100 bg-surface px-6">
            <NotificationBell type="PROMOTION_VIEW" icon={Eye} label="Wejścia na strony promocji" />
            <NotificationBell type="PROMOTION_CLICK" icon={MousePointerClick} label="Kliknięcia w linki afiliacyjne" />
          </div>
          <main className="p-6 md:p-10">{children}</main>
        </div>
      </div>
    </AdminProviders>
  );
}
