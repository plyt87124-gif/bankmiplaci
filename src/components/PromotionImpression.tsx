"use client";

import { useEffect } from "react";

export function PromotionImpression({ promotionId }: { promotionId: string }) {
  useEffect(() => {
    fetch("/api/track/impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionId, source: document.referrer ? "referral" : "direct" }),
      keepalive: true
    }).catch(() => {
      // Analytics failures should never affect the user experience.
    });
  }, [promotionId]);

  return null;
}
