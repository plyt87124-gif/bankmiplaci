import { NextResponse } from "next/server";
import { listEligibilityMarks } from "@/lib/services/blockedPromotions";
import { getCurrentUser } from "@/lib/userSession";

// Depends on the session cookie: never prerendered, never shared.
export const dynamic = "force-dynamic";

/**
 * What the signed-in visitor is told on top of each offer (see services/blockedPromotions.ts):
 * `items` = [{ slug, reason: "client" | "karencja" | "joined", until? }]; `slugs` = the ones that block joining
 * (client / karencja), kept for older callers. Signed out or any failure is a normal empty answer: no front layer.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  const empty = { slugs: [], items: [] };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(empty, { headers });
  try {
    const items = await listEligibilityMarks(user.id);
    return NextResponse.json({ items, slugs: items.filter((m) => m.reason !== "joined").map((m) => m.slug) }, { headers });
  } catch (error) {
    console.error("[eligibility/blocked]", error instanceof Error ? error.message : error);
    return NextResponse.json(empty, { headers });
  }
}
