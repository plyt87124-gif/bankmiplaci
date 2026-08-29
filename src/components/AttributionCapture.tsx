"use client";

import { useEffect } from "react";

export const ATTRIBUTION_STORAGE_KEY = "bmp_attribution";
export const ATTRIBUTION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // see report: 24h safety cap

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export interface AttributionRecord {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  trafficSource: string;
  capturedAt: number;
}

/**
 * Same referrer classification as PageViewTracker — duplicated here
 * (not imported) because the two components run at different points in
 * a visit and must stay independently correct; this is a small, stable
 * pure function, not worth a shared module for two call sites.
 */
function classifyReferrer(): string {
  if (typeof document === "undefined" || !document.referrer) return "direct";
  try {
    const referrerHost = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (referrerHost === window.location.hostname) return "direct";
    if (/(^|\.)(google|bing|duckduckgo|yahoo)\./.test(referrerHost)) return "search";
    if (/(^|\.)(facebook|instagram|twitter|x|linkedin|tiktok)\.com$/.test(referrerHost)) return "social";
    return referrerHost;
  } catch {
    return "direct";
  }
}

/**
 * Captures marketing attribution (utm_* params + referrer-classified
 * traffic source) into sessionStorage — never a cookie, never sent to
 * the server automatically, gone when the tab closes. First-touch
 * semantics: captured once per tab on the first page that has no
 * existing record, and re-captured only when a NEW utm-tagged link is
 * opened in the same tab (so plain internal navigation never clears
 * an earlier campaign attribution). Read later by AffiliateCtaLink to
 * tag the eventual "Przejdź do promocji" click.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const hasUtm = UTM_KEYS.some((k) => params.has(k));
      const existing = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);

      if (existing && !hasUtm) return;

      const record: AttributionRecord = {
        utm_source: params.get("utm_source") ?? undefined,
        utm_medium: params.get("utm_medium") ?? undefined,
        utm_campaign: params.get("utm_campaign") ?? undefined,
        utm_content: params.get("utm_content") ?? undefined,
        utm_term: params.get("utm_term") ?? undefined,
        trafficSource: classifyReferrer(),
        capturedAt: Date.now()
      };
      sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // sessionStorage can throw in some private-browsing modes — never
      // break the page for an attribution write.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
