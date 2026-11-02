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
    // eBroker also publishes a partner link in its public catalog, usable when the panel list has no rate for the campaign.
    const catalog = !offer && network === "EBROKER" ? await db.ebrokerCampaign.findFirst({ where: { promotionId, missingSince: null } }) : null;
    const linkUrl = offer?.trackingUrl ?? catalog?.trackingUrl;
    if (!linkUrl) throw new Error("Ten broker nie ma dziś aktualnej kampanii z linkiem dla tej promocji.");
    const commission = offer ? offerCommissionCents(offer) : null;
    const before = await db.promotion.findUniqueOrThrow({
      where: { id: promotionId },
      select: { affiliateUrl: true, affiliateNetwork: true, affiliateCommissionCents: true }
    });
    await db.$transaction([
      db.promotion.update({
        where: { id: promotionId },
        data: {
          affiliateUrl: linkUrl,
          affiliateNetwork: network,
          affiliateNetworkPinned: true,
          affiliateCommissionCents: commission
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
            after: { affiliateUrl: linkUrl, affiliateNetwork: network, affiliateCommissionCents: commission }
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

/**
 * Ties a broker campaign that has no promotion yet to a promotion on the site
 * (panel offer or catalog campaign). From the next daily sync the campaign
 * takes part in the best-link choice and its rate shows next to the promotion.
 */
export async function linkCampaignToPromotion(kind: "offer" | "catalog", id: string, promotionId: string) {
  const session = await requireAdmin();
  await db.promotion.findUniqueOrThrow({ where: { id: promotionId }, select: { id: true } });
  if (kind === "offer") {
    await db.affiliateOffer.update({ where: { id }, data: { promotionId } });
  } else {
    await db.ebrokerCampaign.update({ where: { oid: id }, data: { promotionId } });
  }
  await db.affiliateChange.create({
    data: {
      kind: "CAMPAIGN_LINKED",
      title: `Kampania ${kind === "offer" ? "z panelu" : "z katalogu eBroker"} ${id} powiązana ręcznie z promocją (${session.user?.email ?? "admin"})`,
      details: { kind, id },
      promotionId
    }
  });
  revalidatePath("/admin/prowizje");
}
