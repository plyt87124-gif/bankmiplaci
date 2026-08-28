import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminProviders } from "./AdminProviders";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";
import { SidebarNav } from "./SidebarNav";

export const metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/logowanie");

  return (
    <AdminProviders>
      <div className="flex min-h-screen bg-paper">
        <aside className="hidden w-64 shrink-0 border-r border-ink-100 bg-surface p-5 md:block">
          <p className="font-display text-lg font-semibold">Bankmiplaci — Admin</p>
          <SidebarNav />
          <div className="mt-10 border-t border-ink-100 pt-4">
            <p className="text-xs text-ink-500">{session.user?.email}</p>
            <SignOutButton />
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex h-14 items-center justify-end gap-2 border-b border-ink-100 bg-surface px-6">
            <NotificationBell type="NEW_USER" label="Nowe konta użytkowników" />
            <NotificationBell type="PROMOTION_VIEW" label="Wejścia na strony promocji" />
            <NotificationBell type="PROMOTION_CLICK" label="Kliknięcia w linki afiliacyjne" />
          </div>
          <main className="p-6 md:p-10">{children}</main>
        </div>
      </div>
    </AdminProviders>
  );
}
