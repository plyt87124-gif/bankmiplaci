"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * document.referrer only reflects the browser's referrer for the actual
 * HTTP navigation that loaded this tab — it never changes on client-side
 * route changes. So this classifies once per tab load and reuses that
 * value for every subsequent pageview in the session, which is what we
 * want: attribute the whole visit to where it originally came from,
 * not to "the previous page on this site".
 */
function classifySource(): string {
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

export function PageViewTracker() {
  const pathname = usePathname();
  const source = useRef<string>();
  if (source.current === undefined) source.current = classifySource();

  useEffect(() => {
    fetch("/api/track/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, source: source.current }),
      keepalive: true
    }).catch(() => {
      // Analytics failures should never affect the user experience.
    });
  }, [pathname]);

  return null;
}
