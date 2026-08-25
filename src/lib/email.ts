import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail({
  to,
  subject,
  html,
  replyTo
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  if (!resend) {
    console.error(`[email] RESEND_API_KEY nie jest ustawiony — nie wysłano maila do ${to} ("${subject}").`);
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Bankmiplaci <onboarding@resend.dev>",
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {})
    });
  } catch (error) {
    console.error(`[email] Nie udało się wysłać maila do ${to}:`, error);
  }
}
