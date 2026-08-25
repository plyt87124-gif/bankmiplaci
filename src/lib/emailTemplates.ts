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

export function eligibilityReminderEmailHtml({
  userName,
  bankName,
  promotionsUrl
}: {
  userName: string;
  bankName: string;
  promotionsUrl: string;
}) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px;">Możesz już skorzystać z promocji ${bankName}</h1>
      <p>Cześć ${userName},</p>
      <p>Twój okres karencji dla banku <strong>${bankName}</strong> właśnie się zakończył — zgodnie z datą podaną w „Moje konto”, możesz teraz kwalifikować się do jego aktualnych promocji.</p>
      <p>
        <a href="${promotionsUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 999px;">
          Zobacz promocje ${bankName}
        </a>
      </p>
      <p style="color: #64748b; font-size: 12px;">Zawsze zweryfikuj aktualny regulamin promocji przed założeniem konta — warunki mogą się zmienić po stronie banku.</p>
    </div>
  `;
}
