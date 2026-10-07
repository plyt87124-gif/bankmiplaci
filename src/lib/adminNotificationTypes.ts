import type { AdminNotificationType } from "@prisma/client";

/** Notification types raised by the offer-monitoring jobs, shown together in one admin bell. */
export const PROMO_WATCH_TYPES: AdminNotificationType[] = [
  "EBROKER_NEW_CAMPAIGN",
  "EBROKER_CAMPAIGN_CHANGED",
  "EBROKER_CAMPAIGN_REMOVED",
  "PROMOTION_CHECK_NEEDED",
  "PROMOTION_AUTO_ADDED",
  "PROMOTION_EXPIRED"
];
