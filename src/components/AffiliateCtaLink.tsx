"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { ArrowRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { ATTRIBUTION_STORAGE_KEY, ATTRIBUTION_MAX_AGE_MS, type AttributionRecord } from "@/components/AttributionCapture";
import { AFFILIATE_LINK_REL } from "@/components/trust/affiliateRel";
import { withAttribution } from "@/components/trust/attributionHref";

/**
 * THE link to a bank: every CTA that leads to /out/[slug] (the affiliate
 * redirect, built with outboundHref() from lib/affiliate.ts) goes through
 * this component, rendered as the design system's `cta` button (accent fill,
 * trailing arrow - the arrow comes from the button, do not add one in the
 * children).
 *
 * What this component guarantees, whatever the caller passes:
 *  - it is a real <a href="/out/...">: ctrl/middle-click and "open in new
 *    tab" work natively, the click itself is never intercepted and no
 *    animation or state delays the navigation;
 *  - rel="sponsored nofollow noopener noreferrer" (not overridable);
 *  - prefetch is OFF (not overridable): a prefetch of /out/... would log a
 *    click that never happened;
 *  - target defaults to "_blank" (the offer's CTA opens the bank in a new
 *    tab); pass target="_self" to stay in the tab.
 *
 * Under the button ALWAYS put <AffiliateDisclosure variant="compact" />
 * (that is the caller's job: where the text sits depends on the layout).
 *
 * Attribution: renders the plain server-computed href on first paint (so SSR
 * and the first client render match exactly - no hydration mismatch), then
 * augments it, moments after mount, with whatever marketing attribution
 * AttributionCapture stored in sessionStorage for this tab (utm_*, traffic
 * source). Corrupt or unavailable storage leaves the href as it was.
 */
type Props = Omit<ComponentProps<"a">, "href" | "rel"> &
  Pick<NonNullable<Parameters<typeof buttonClasses>[0]>, "size" | "fullWidth"> & {
  href: string;
  /** @deprecated Ignored: the rel is always AFFILIATE_LINK_REL. Accepted only so older call sites still compile. */
  rel?: string;
  /** @deprecated Ignored: prefetch is always off. Accepted only so older call sites still compile. */
  prefetch?: boolean;
};

export function AffiliateCtaLink({ href: baseHref, target = "_blank", rel, prefetch, size, fullWidth, className, children, ...props }: Props) {
  void rel;
  void prefetch;
  // Remember which base the augmented href belongs to, so a changed `href`
  // prop is never shadowed by a stale augmented one.
  const [augmented, setAugmented] = useState<{ base: string; href: string } | null>(null);
  const href = augmented && augmented.base === baseHref ? augmented.href : baseHref;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      if (!raw) return;
      const attribution = JSON.parse(raw) as AttributionRecord;
      setAugmented({ base: baseHref, href: withAttribution(baseHref, attribution, Date.now(), ATTRIBUTION_MAX_AGE_MS) });
    } catch {
      // Never break the CTA if sessionStorage is unavailable or corrupt -
      // worst case, the click is recorded without attribution.
    }
  }, [baseHref]);

  // A real anchor on purpose: the click must never be intercepted by the client router
  // (that would request /out twice), and ctrl/middle-click must work natively.
  return (
    <a
      {...props}
      href={href}
      target={target}
      rel={AFFILIATE_LINK_REL}
      className={buttonClasses({ variant: "cta", size, fullWidth, className })}
    >
      {children}
      <ArrowRight size={18} aria-hidden="true" className="shrink-0 transition-transform duration-200 ease-out group-hover/cta:translate-x-1 group-focus-visible/cta:translate-x-1 motion-reduce:transition-none" />
    </a>
  );
}
