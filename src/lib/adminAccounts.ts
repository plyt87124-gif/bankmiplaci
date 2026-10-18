/**
 * The two public (visitor) accounts the site owner switches between while
 * signed in to the admin panel:
 *
 *   tester  "Konto testowe": for checking that a ściąga, the karencja logic
 *           and so on work. Its data is throw-away. Put its e-mail in
 *           INTERNAL_TRAFFIC_EMAILS too, so its visits never count as traffic.
 *   own     "Moje konto": the owner as an ordinary user, who really tracks the
 *           promotions they take part in.
 *
 * Both are ordinary accounts created through the normal registration; this
 * file only says which e-mails they are (env, nothing in the database). The
 * admin panel session (NextAuth) and the visitor session (premia_session
 * cookie) are independent cookies, so being an admin and a user at once needs
 * nothing more than a way to start the visitor session without a password:
 * /api/admin/switch-user, which only an admin session may call.
 */
export type SwitchAccountKey = "tester" | "own";

export interface SwitchAccount {
  key: SwitchAccountKey;
  label: string;
  email: string;
}

export function getSwitchAccounts(env: Record<string, string | undefined> = process.env): SwitchAccount[] {
  const accounts: SwitchAccount[] = [];
  const tester = env.ADMIN_TEST_USER_EMAIL?.trim().toLowerCase();
  const own = env.ADMIN_OWN_USER_EMAIL?.trim().toLowerCase();
  if (tester) accounts.push({ key: "tester", label: "Konto testowe", email: tester });
  if (own) accounts.push({ key: "own", label: "Moje konto", email: own });
  return accounts;
}
