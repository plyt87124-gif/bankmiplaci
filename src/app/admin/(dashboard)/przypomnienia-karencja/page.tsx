import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { markReminderRead } from "./actions";
import { Mail, CalendarClock } from "lucide-react";

export default async function EligibilityRemindersPage() {
  const [unread, read] = await Promise.all([
    db.adminNotification.findMany({ where: { type: "ELIGIBILITY_CLEARED", read: false }, orderBy: { createdAt: "desc" } }),
    db.adminNotification.findMany({ where: { type: "ELIGIBILITY_CLEARED", read: true }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);

  const userIds = [...unread, ...read].map((n) => n.relatedUserId).filter((id): id is string => !!id);
  const users = await db.user.findMany({ where: { id: { in: userIds } } });
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div>
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-1 h-6 w-6 text-gold-600" />
        <div>
          <h1 className="text-2xl font-semibold">Przypomnienia o zakończonej karencji</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            Ta sekcja pokazuje, kiedy zalogowanym użytkownikom minął okres karencji w danym banku — czyli mogą
            już skorzystać z jego promocji. Nie wysyłamy tego automatycznie mailem (brak podłączonego dostawcy
            poczty) — możesz jednak ręcznie napisać do takiej osoby, klikając jej adres e-mail poniżej.
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink-900">Nowe ({unread.length})</h2>
        <div className="mt-3 space-y-2">
          {unread.map((n) => {
            const user = n.relatedUserId ? userById.get(n.relatedUserId) : undefined;
            return (
              <div key={n.id} className="flex items-center justify-between rounded-xl2 border border-gold-100 bg-gold-100/30 p-4">
                <div>
                  <p className="text-sm font-medium text-ink-900">{n.title}</p>
                  <p className="mt-1 text-sm text-ink-700">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-300">{formatDate(n.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {user && (
                    <a
                      href={`mailto:${user.email}?subject=${encodeURIComponent("Możesz już skorzystać z nowej promocji")}`}
                      className="flex items-center gap-1.5 rounded-full border border-ink-100 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
                    >
                      <Mail className="h-3.5 w-3.5" /> Napisz do {user.email}
                    </a>
                  )}
                  <form action={markReminderRead.bind(null, n.id)}>
                    <button className="text-xs font-medium text-teal-700 hover:underline">Oznacz jako przeczytane</button>
                  </form>
                </div>
              </div>
            );
          })}
          {unread.length === 0 && <p className="text-sm text-ink-500">Brak nowych przypomnień.</p>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-ink-500">Wcześniejsze (przeczytane)</h2>
        <div className="mt-3 space-y-2">
          {read.map((n) => (
            <div key={n.id} className="rounded-xl2 border border-ink-100 bg-surface p-4 opacity-70">
              <p className="text-sm text-ink-700">{n.body}</p>
              <p className="mt-1 text-xs text-ink-300">{formatDate(n.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
