import { NextResponse } from "next/server";
import { listBlockedPromotionSlugs } from "@/lib/services/blockedPromotions";
import { getCurrentUser } from "@/lib/userSession";

// Depends on the session cookie: never prerendered, never shared.
export const dynamic = "force-dynamic";

/**
 * Slugs of the offers the signed-in user cannot take part in because of a
 * karencja (see services/blockedPromotions.ts). Signed out or any failure is a
 * normal empty answer: the cards simply get no red glow.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ slugs: [] }, { headers });
  try {
    return NextResponse.json({ slugs: await listBlockedPromotionSlugs(user.id) }, { headers });
  } catch (error) {
    console.error("[eligibility/blocked]", error instanceof Error ? error.message : error);
    return NextResponse.json({ slugs: [] }, { headers });
  }
}
