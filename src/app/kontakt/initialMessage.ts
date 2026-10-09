/**
 * Starting text of the contact message when the visitor arrives from an offer
 * ("Zgłoś błąd w tej ofercie" -> /kontakt?oferta=<slug>). Only a plain slug
 * (letters, digits, hyphens) is accepted; anything else - a URL, markup, a long
 * string - is ignored and the message starts empty. The text goes into a
 * textarea's defaultValue, where React escapes it, and the visitor can edit it.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function initialMessageFor(oferta: string | string[] | undefined): string {
  const value = Array.isArray(oferta) ? oferta[0] : oferta;
  if (typeof value !== "string" || value.length === 0 || value.length > 120 || !SLUG.test(value)) return "";
  return `Dotyczy oferty: /promocje/${value}\n\nCo jest nieprawidłowe: `;
}
