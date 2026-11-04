import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userSession";
import { getChecklistAlerts } from "@/lib/services/checklistAlerts";

// Depends on the session cookie and on the ticks, so it must never be prerendered or shared.
export const dynamic = "force-dynamic";

/**
 * Approaching ściąga deadlines of the signed-in user, for the bell next to
 * "Moje konto" in the header (src/components/ChecklistAlerts.tsx).
 *
 * Signed out is a normal answer (200, no items), not an error, so the browser
 * console stays clean. Only what the bell shows is returned: the promotion and
 * bank names, the group label, the days left and the number of open steps.
 * `no-store` + `Vary: Cookie`: the answer differs per cookie and per tick.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] }, { headers });

  const items = await getChecklistAlerts(user.id).catch(() => []);
  return NextResponse.json({ items }, { headers });
}
