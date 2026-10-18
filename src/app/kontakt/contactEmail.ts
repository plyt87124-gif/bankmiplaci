/**
 * Helpers for the e-mail that /api/contact sends to the support mailbox.
 *
 * The form text comes from an anonymous visitor and used to be pasted into the
 * HTML body as is, so anything like `<img src=... onerror=...>` or a fake
 * "Od:" link ended up as live markup in the operator's mail client. Both fields
 * are escaped here before they go into the template.
 *
 * Lives next to the form (the files WP-13 owns) so a unit test can import it
 * without loading the route handler's runtime dependencies.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

/** Escapes the five characters that can open or close markup or an attribute. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/** Subject line: plain text, forced onto a single line (no header injection through the address). */
export function contactEmailSubject(fromEmail: string): string {
  const oneLine = fromEmail.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
  return `Nowa wiadomość z formularza kontaktowego — ${oneLine}`;
}

/** HTML body of the notification. `message` keeps its line breaks (white-space: pre-wrap), but never its markup. */
export function buildContactEmailHtml({ email, message }: { email: string; message: string }): string {
  return `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h1 style="font-size: 18px;">Nowa wiadomość z formularza kontaktowego</h1>
          <p><strong>Od:</strong> ${escapeHtml(email)}</p>
          <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
      `;
}
