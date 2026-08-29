"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ATTRIBUTION_STORAGE_KEY, ATTRIBUTION_MAX_AGE_MS, type AttributionRecord } from "@/components/AttributionCapture";

/**
 * Wraps ButtonLink for the one CTA in the app that leads to /out/[slug]
 * (the affiliate redirect). Renders the plain server-computed href on
 * first paint (so SSR and the first client render match exactly — no
 * hydration mismatch), then augments it, moments after mount, with
 * whatever marketing attribution AttributionCapture stored in
 * sessionStorage for this tab. It's still a real <a href> the whole
 * time, so ctrl/middle-click and "open in new tab" keep working
 * natively — this never intercepts the click itself.
 */
type Props = Omit<ComponentProps<typeof ButtonLink>, "href"> & { href: string };

export function AffiliateCtaLink({ href: baseHref, ...props }: Props) {
  const [href, setHref] = useState(baseHref);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      if (!raw) return;

      const attribution = JSON.parse(raw) as AttributionRecord;
      if (!attribution.capturedAt || Date.now() - attribution.capturedAt > ATTRIBUTION_MAX_AGE_MS) return;

      const url = new URL(baseHref, window.location.origin);
      if (attribution.utm_source) url.searchParams.set("utm_source", attribution.utm_source);
      if (attribution.utm_medium) url.searchParams.set("utm_medium", attribution.utm_medium);
      if (attribution.utm_campaign) url.searchParams.set("utm_campaign", attribution.utm_campaign);
      if (attribution.utm_content) url.searchParams.set("utm_content", attribution.utm_content);
      if (attribution.utm_term) url.searchParams.set("utm_term", attribution.utm_term);
      if (attribution.trafficSource) url.searchParams.set("traffic_source", attribution.trafficSource);
      setHref(`${url.pathname}${url.search}`);
    } catch {
      // Never break the CTA if sessionStorage is unavailable or corrupt —
      // worst case, the click is recorded without attribution.
    }
  }, [baseHref]);

  return <ButtonLink href={href} {...props} />;
}
