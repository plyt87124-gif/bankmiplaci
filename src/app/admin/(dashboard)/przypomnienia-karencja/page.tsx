import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { CalendarClock, CheckCircle2, Circle, Mail, MailCheck, MousePointerClick } from "lucide-react";
import { MarkNotificationsSeen } from "../MarkNotificationsSeen";

export default async function EligibilityRemindersPage() {
  const rows = await db.userBankHistory.findMany({
    where: { eligibilityNotifiedAt: { not: null } },
    include: { user: true, bank: true, eligibilityPromotion: { select: { name: true, slug: true } } },
    orderBy: { eligibilityNotifiedAt: "desc" },
    take: 100
  });

  const tokens = rows.map((r) => r.eligibilityEmailToken).filter((t): t is string => !!t);
  const clicks =
    tokens.length > 0
      ? await db.click.findMany({
          where: { campaign: { in: tokens } },
          orderBy: { createdAt: "asc" },
          select: { campaign: true, createdAt: true }
        })
      : [];
  const ctaClickedAtByToken = new Map<string, Date>();
  for (const c of clicks) {
    if (c.campaign && !ctaClickedAtByToken.has(c.campaign)) ctaClickedAtByToken.set(c.campaign, c.createdAt);
  }

  return (
    <div>
      <MarkNotificationsSeen type="ELIGIBILITY_CLEARED" />
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-1 h-6 w-6 text-gold-600" />
        <div>
          <h1 className="text-2xl font-semibold">Przypomnienia o zakończonej karencji</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            Gdy zalogowanemu użytkownikowi mija okres karencji w danym banku, automatycznie wysyłamy mu maila z
            linkiem do najlepiej ocenianej aktywnej promocji tego banku. Poniżej widzisz, komu i kiedy wysłaliśmy
            maila, czy kliknął/ęła link w mailu, oraz czy następnie kliknęła/ął „Przejdź do promocji” na stronie.
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl2 border border-ink-100">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="p-3">Użytkownik</th>
              <th className="p-3">Bank / konto</th>
              <th className="p-3">Karencja minęła</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Kliknął link</th>
              <th className="p-3">Kliknął „Przejdź do promocji”</th>
              <th className="p-3">Promocja</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ctaClickedAt = row.eligibilityEmailToken ? ctaClickedAtByToken.get(row.eligibilityEmailToken) : undefined;
              return (
                <tr key={row.id} className="border-b border-ink-100 last:border-0">
                  <td className="p-3">
                    <p className="font-medium text-ink-900">{row.user.name || row.user.email}</p>
                    <p className="text-xs text-ink-500">{row.user.email}</p>
                  </td>
                  <td className="p-3">
                    <p className="text-ink-900">{row.bank.name}</p>
                    <p className="text-xs text-ink-500">{row.accountType}</p>
                  </td>
                  <td className="p-3 text-ink-700">{row.eligibilityClearedAt ? formatDate(row.eligibilityClearedAt) : "—"}</td>
                  <td className="p-3">
                    {row.eligibilityNotifiedAt ? (
                      <span className="flex items-center gap-1.5 text-teal-700">
                        <MailCheck className="h-4 w-4" /> {formatDate(row.eligibilityNotifiedAt)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink-300">
                        <Mail className="h-4 w-4" /> nie wysłano
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {row.eligibilityLinkClickedAt ? (
                      <span className="flex items-center gap-1.5 text-teal-700">
                        <CheckCircle2 className="h-4 w-4" /> {formatDate(row.eligibilityLinkClickedAt)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink-300">
                        <Circle className="h-4 w-4" /> nie kliknął/ęła
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {ctaClickedAt ? (
                      <span className="flex items-center gap-1.5 text-teal-700">
                        <MousePointerClick className="h-4 w-4" /> {formatDate(ctaClickedAt)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink-300">
                        <Circle className="h-4 w-4" /> nie kliknął/ęła
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {row.eligibilityPromotion ? (
                      <a
                        href={`/promocje/${row.eligibilityPromotion.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-700 hover:underline"
                      >
                        {row.eligibilityPromotion.name}
                      </a>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm text-ink-500">
                  Nikomu jeszcze nie minęła karencja od kiedy ta funkcja działa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
