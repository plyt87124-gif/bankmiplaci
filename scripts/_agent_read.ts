import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const since = new Date(Date.now() - 2 * 86400000);
  const n = await (p as any).adminNotification.findMany({ where: { createdAt: { gte: since }, type: { in: ["EBROKER_NEW_CAMPAIGN","EBROKER_CAMPAIGN_CHANGED","EBROKER_CAMPAIGN_REMOVED","PROMOTION_CHECK_NEEDED"] } }, orderBy: { createdAt: "desc" } });
  console.log("NOTIFS", JSON.stringify(n, null, 1));
  const c = await (p as any).ebrokerCampaign.findMany();
  console.log("CAMPAIGNS", c.length, "watched", c.filter((x:any)=>x.watched).length, "missing", c.filter((x:any)=>x.missingSince).length, "linked", c.filter((x:any)=>x.promotionId).length);
  await p.$disconnect();
})();
