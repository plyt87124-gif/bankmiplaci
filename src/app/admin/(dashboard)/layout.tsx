import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { AdminProviders } from "./AdminProviders";
import { LayoutDashboard, Tag, Landmark, Users, MessageCircle, CalendarClock, BarChart3 } from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";

export const metadata = { robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Pulpit", icon: LayoutDashboard },
  { href: "/admin/statystyki", label: "Statystyki", icon: BarChart3 },
  { href: "/admin/promocje", label: "Promocje", icon: Tag },
  { href: "/admin/banki", label: "Banki", icon: Landmark },
  { href: "/admin/uzytkownicy", label: "Użytkownicy", icon: Users },
  { href: "/admin/komentarze", label: "Komentarze", icon: MessageCircle },
  { href: "/admin/przypomnienia-karencja", label: "Przypomnienia (karencja)", icon: CalendarClock }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/logowanie");

  return (
    <AdminProviders>
      <div className="flex min-h-screen bg-paper">
        <aside className="hidden w-64 shrink-0 border-r border-ink-100 bg-surface p-5 md:block">
          <p className="font-display text-lg font-semibold">Bankmiplaci — Admin</p>
          <nav className="mt-8 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 border-t border-ink-100 pt-4">
            <p className="text-xs text-ink-500">{session.user?.email}</p>
            <SignOutButton />
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex h-14 items-center justify-end border-b border-ink-100 bg-surface px-6">
            <NotificationBell />
          </div>
          <main className="p-6 md:p-10">{children}</main>
        </div>
      </div>
    </AdminProviders>
  );
}
