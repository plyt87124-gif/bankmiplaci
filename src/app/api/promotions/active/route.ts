import { NextResponse } from "next/server";
import { listActivePromotions } from "@/lib/services/promotions";

export const dynamic = "force-dynamic";

export async function GET() {
  const promotions = await listActivePromotions({ sort: "top-rated" });
  return NextResponse.json({ promotions });
}
