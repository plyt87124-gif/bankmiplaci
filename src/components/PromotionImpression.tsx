"use client";

import { useEffect } from "react";
import { ATTRIBUTION_STORAGE_KEY, ATTRIBUTION_MAX_AGE_MS, type AttributionRecord } from "@/components/AttributionCapture";

/** Reads whatever AttributionCapture stored for this tab, if still fresh. */
function readAttribution(): AttributionRecord | null {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const attribution = JSON.parse(raw) as AttributionRecord;
    if (!attribution.capturedAt || Date.now() - attribution.capturedAt > ATTRIBUTION_MAX_AGE_MS) return null;
    return attribution;
  } catch {
    return null;
  }
}

export function PromotionImpression({ promotionId }: { promotionId: string }) {
  useEffect(() => {
    const attribution = readAttribution();
    fetch("/api/track/impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promotionId,
        source: document.referrer ? "referral" : "direct",
        trafficSource: attribution?.trafficSource,
        utmSource: attribution?.utm_source,
        utmMedium: attribution?.utm_medium,
        utmCampaign: attribution?.utm_campaign,
        utmContent: attribution?.utm_content,
        utmTerm: attribution?.utm_term
      }),
      keepalive: true
    }).catch(() => {
      // Analytics failures should never affect the user experience.
    });
  }, [promotionId]);

  return null;
}
