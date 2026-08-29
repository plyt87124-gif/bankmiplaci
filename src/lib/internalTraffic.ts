/**
 * Site owner / test accounts whose activity should never count as real
 * traffic — see INTERNAL_TRAFFIC_EMAILS in .env. Checked wherever a
 * page view, impression, or affiliate click is about to be written.
 * Only covers logged-in visits: the same person browsing while logged
 * out can't be distinguished from a real visitor without a persistent
 * client-side identifier (which the site deliberately doesn't use).
 */
function internalEmails(): Set<string> {
  return new Set(
    (process.env.INTERNAL_TRAFFIC_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isInternalUser(email?: string | null): boolean {
  if (!email) return false;
  return internalEmails().has(email.toLowerCase());
}
