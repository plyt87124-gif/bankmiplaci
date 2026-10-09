import { NextResponse } from "next/server";
import { listPromotionCards } from "@/lib/services/promotionCards";

// Stays dynamic (no build-time database access); caching is the CDN's job via
// the Cache-Control header below. The payload is public data only
// (PromotionCardData: no affiliateUrl, no partner commission), so a shared
// cache is safe, and five minutes of staleness is harmless.
export const dynamic = "force-dynamic";

export async function GET() {
  const promotions = await listPromotionCards({ sort: "top-rated" });
  return NextResponse.json(
    { promotions },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
