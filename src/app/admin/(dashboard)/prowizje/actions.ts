"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isUsableOffer, offerCommissionCents, type Network } from "@/lib/affiliateNetworks";
import { revertLinkSwitch } from "@/lib/services/affiliateSync";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Nieautoryzowany dostęp.");
  return session;
}

/**
 * Pins a promotion's link to one network (the daily sync then leaves it
 * alone) and points the link at that network's campaign right away.
 * `network` null = unpin, the daily sync decides again from tomorrow.
 */
export async function pinAffiliateNetwork(promotionId: string, network: Network | null) {
  const session = await requireAdmin();
  if (network === null) {
    await db.promotion.update({ where: { id: promotionId }, data: { affiliateNetworkPinned: false } });
  } else {
    const offers = await db.affiliateOffer.findMany({ where: { promotionId, network } });
    const offer = offers
      .filter((o) => isUsableOffer(o, new Date()))
      .sort((a, b) => (offerCommissionCents(b) ?? 0) - (offerCommissionCents(a) ?? 0))[0];
    if (!offer?.trackingUrl) throw new Error("Ten broker nie ma dziś aktualnej kampanii z linkiem dla tej promocji.");
    const before = await db.promotion.findUniqueOrThrow({
      where: { id: promotionId },
      select: { affiliateUrl: true, affiliateNetwork: true, affiliateCommissionCents: true }
    });
    await db.$transaction([
      db.promotion.update({
        where: { id: promotionId },
        data: {
          affiliateUrl: offer.trackingUrl,
          affiliateNetwork: network,
          affiliateNetworkPinned: true,
          affiliateCommissionCents: offerCommissionCents(offer)
        }
      }),
      db.affiliateChange.create({
        data: {
          network,
          kind: "LINK_SWITCHED",
          title: `Link przypięty ręcznie do ${network === "EBROKER" ? "eBroker" : "Comperia"} (${session.user?.email ?? "admin"})`,
          details: {
            manual: true,
            before,
            after: { affiliateUrl: offer.trackingUrl, affiliateNetwork: network, affiliateCommissionCents: offerCommissionCents(offer) }
          },
          promotionId
        }
      })
    ]);
  }
  revalidatePath("/admin/prowizje");
}

export async function revertAffiliateLinkSwitch(changeId: string) {
  await requireAdmin();
  await revertLinkSwitch(db, changeId);
  revalidatePath("/admin/prowizje");
}
