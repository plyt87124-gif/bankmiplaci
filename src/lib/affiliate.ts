/**
 * Affiliate abstraction layer.
 *
 * Rule from the spec: no component ever renders `promotion.affiliateUrl`
 * directly. Instead every "Przejdź do promocji" CTA points at this
 * internal redirect route, which:
 *   1. logs a Click row (for CTR reporting in the admin panel), then
 *   2. 302-redirects the visitor to the real, admin-configured
 *      affiliateUrl stored in the database.
 *
 * This keeps the real partner links out of the HTML entirely (so they
 * can be swapped by an admin without a deploy) and gives a single choke
 * point for click tracking, rate limiting, and future compliance needs
 * (e.g. rel="sponsored", consent checks).
 */
export function outboundHref(promotionSlug: string, opts?: { source?: string; campaign?: string }): string {
  const params = new URLSearchParams();
  if (opts?.source) params.set("src", opts.source);
  if (opts?.campaign) params.set("cmp", opts.campaign);
  const qs = params.toString();
  return `/out/${promotionSlug}${qs ? `?${qs}` : ""}`;
}
