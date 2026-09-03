import { db } from "@/lib/db";

/**
 * Touches User.lastActiveAt — the presence signal behind the admin
 * "aktywny/a" dot/count/sort on /admin/uzytkownicy (see
 * ActivityProvider.tsx). Call this from every endpoint a logged-in user
 * actually interacts with (not just page navigation), so the dot doesn't
 * go stale for someone who's, say, only clicking through to banks or
 * checking off ściąga steps without a fresh full page load in between.
 *
 * Deliberately unconditional — no isInternalUser gate here. That gate
 * exists to keep the owner's own browsing out of visit-count analytics
 * elsewhere; it must never also starve their own "is the owner online"
 * signal in their own admin panel.
 *
 * Fire-and-forget by design (not awaited by callers): never let this
 * best-effort presence write block or fail the actual request.
 */
export function touchUserActivity(userId: string): void {
  db.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } }).catch(() => {
    // Best-effort — never let this fail the caller's real work.
  });
}
