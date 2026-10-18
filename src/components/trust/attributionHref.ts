import type { AttributionRecord } from "@/components/AttributionCapture";

/**
 * Pure part of AffiliateCtaLink: adds the marketing attribution captured in
 * sessionStorage (utm_* + traffic source) to a /out/... href. Extracted so the
 * rule can be unit-tested; the logic is unchanged from the original component.
 *
 * Returns the href to use, or `baseHref` unchanged when there is no usable
 * attribution (missing, no timestamp, older than `maxAgeMs`).
 * Output is always path + query (any host or hash in `baseHref` is dropped),
 * as before.
 */
export function withAttribution(
  baseHref: string,
  attribution: AttributionRecord | null | undefined,
  now: number,
  maxAgeMs: number
): string {
  if (!attribution || !attribution.capturedAt || now - attribution.capturedAt > maxAgeMs) return baseHref;

  const url = new URL(baseHref, "http://localhost");
  if (attribution.utm_source) url.searchParams.set("utm_source", attribution.utm_source);
  if (attribution.utm_medium) url.searchParams.set("utm_medium", attribution.utm_medium);
  if (attribution.utm_campaign) url.searchParams.set("utm_campaign", attribution.utm_campaign);
  if (attribution.utm_content) url.searchParams.set("utm_content", attribution.utm_content);
  if (attribution.utm_term) url.searchParams.set("utm_term", attribution.utm_term);
  if (attribution.trafficSource) url.searchParams.set("traffic_source", attribution.trafficSource);
  return `${url.pathname}${url.search}`;
}
