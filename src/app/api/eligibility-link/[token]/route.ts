import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The link inside the karencja-cleared email points here. Stamps
 * eligibilityLinkClickedAt (funnel step 1: "opened the email link"),
 * then forwards to the specific promotion we picked at send time —
 * carrying the same token as `?ref=` so the promotion page's "Przejdź
 * do promocji" CTA can tag its outbound Click with it (funnel step 2).
 * Falls back to the bank's filtered promotion list if no promotion was
 * linked (or it's since gone inactive).
 */
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const row = await db.userBankHistory.findUnique({
    where: { eligibilityEmailToken: params.token },
    include: { bank: true, eligibilityPromotion: { select: { slug: true, status: true } } }
  });

  if (!row) {
    return NextResponse.redirect(new URL("/promocje", request.url));
  }

  if (!row.eligibilityLinkClickedAt) {
    await db.userBankHistory.update({
      where: { id: row.id },
      data: { eligibilityLinkClickedAt: new Date() }
    });
  }

  if (row.eligibilityPromotion && row.eligibilityPromotion.status === "ACTIVE") {
    return NextResponse.redirect(
      new URL(`/promocje/${row.eligibilityPromotion.slug}?ref=${params.token}`, request.url)
    );
  }

  return NextResponse.redirect(new URL(`/promocje?bank=${row.bank.slug}`, request.url));
}
