"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * "Poleć znajomemu": the native share sheet where there is one, otherwise the
 * page link is copied. `url` must be ABSOLUTE (build it with absoluteUrl() from
 * "@/lib/seo", never from process.env). The result of a copy is announced in a
 * polite status region, not only by the changing label.
 */
export function ShareButton({
  url,
  title,
  className,
  fullWidth
}: {
  url: string;
  title: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled the native share sheet - do nothing.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable - nothing more we can do gracefully.
    }
  }

  return (
    <span className={fullWidth ? `block ${className ?? ""}` : className}>
      <Button variant="secondary" fullWidth={fullWidth} onClick={handleShare}>
        {copied ? <Check size={16} aria-hidden="true" className="shrink-0" /> : <Share2 size={16} aria-hidden="true" className="shrink-0" />}
        {copied ? "Link skopiowany" : "Poleć znajomemu"}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Link do tej strony został skopiowany" : ""}
      </span>
    </span>
  );
}
