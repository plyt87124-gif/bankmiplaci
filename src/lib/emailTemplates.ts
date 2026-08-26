export function passwordResetEmailHtml(resetUrl: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px;">Reset hasła — Bankmiplaci</h1>
      <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w Bankmiplaci.</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 999px;">
          Ustaw nowe hasło
        </a>
      </p>
      <p>Link jest ważny przez 1 godzinę. Jeśli to nie Ty poprosiłeś/aś o reset hasła, zignoruj tę wiadomość.</p>
      <p style="color: #64748b; font-size: 12px;">Jeśli przycisk nie działa, skopiuj ten link do przeglądarki: ${resetUrl}</p>
    </div>
  `;
}

export function checklistDeadlineReminderEmailHtml({
  userName,
  items,
  accountUrl
}: {
  userName: string;
  items: {
    bankName: string;
    promotionName: string;
    monthLabel: string;
    daysLeft: number;
    rewardLabel: string | null;
  }[];
  accountUrl: string;
}) {
  const rows = items
    .map(
      (i) => `
        <li style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
          <strong>${i.bankName} — ${i.promotionName}</strong><br />
          <span style="color: #475569;">${i.monthLabel}: zostało ${i.daysLeft} ${i.daysLeft === 1 ? "dzień" : "dni"}, a nie masz jeszcze odznaczonych wszystkich kroków.</span>
          ${i.rewardLabel ? `<br /><span style="color: #b45309;">Do zdobycia: ${i.rewardLabel}</span>` : ""}
        </li>`
    )
    .join("");

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px;">Zbliża się termin w Twojej ściądze</h1>
      <p>Cześć ${userName},</p>
      <p>Za mniej niż 7 dni kończy się okres na spełnienie warunków w tym miesiącu dla poniższych promocji, które śledzisz — a nie masz jeszcze zaznaczonych wszystkich kroków:</p>
      <ul style="list-style: none; padding: 0; margin: 16px 0;">${rows}</ul>
      <p>
        <a href="${accountUrl}" style="display: inline-block; margin: 8px 0 16px; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 999px;">
          Otwórz moje ściągi
        </a>
      </p>
      <p style="color: #64748b; font-size: 12px;">To automatyczne przypomnienie na podstawie dat, które podałeś/aś przy otwieraniu kont. Zawsze zweryfikuj rzeczywiste terminy w regulaminie promocji.</p>
    </div>
  `;
}

export function eligibilityReminderEmailHtml({
  userName,
  bankName,
  promotionName,
  linkUrl
}: {
  userName: string;
  bankName: string;
  /** Null when no ACTIVE promotion with a matching cooldown was found for this bank+accountType at send time. */
  promotionName: string | null;
  linkUrl: string;
}) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px;">Możesz już skorzystać z promocji ${bankName}</h1>
      <p>Cześć ${userName},</p>
      <p>Twój okres karencji dla banku <strong>${bankName}</strong> właśnie się zakończył — zgodnie z datą podaną w „Moje konto”, możesz teraz kwalifikować się do jego aktualnych promocji.</p>
      <p>
        <a href="${linkUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 999px;">
          ${promotionName ? `Zobacz „${promotionName}”` : `Zobacz promocje ${bankName}`}
        </a>
      </p>
      <p style="color: #64748b; font-size: 12px;">Zawsze zweryfikuj aktualny regulamin promocji przed założeniem konta — warunki mogą się zmienić po stronie banku.</p>
    </div>
  `;
}
