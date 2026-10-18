"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { bankMonogram } from "@/lib/format";

/**
 * Bank logo on a fixed WHITE tile (same in both themes, so every logo - dark
 * or light, with or without its own background - stays legible), with a
 * monogram fallback when there is no URL or the image fails to load.
 * The bank's name is real text next to the logo, so it is not repeated
 * under it. Sizes are the TILE size (px): xs 88x32 (table), sm 112x40 (card),
 * md 140x48 (comparison, checklist), lg 160x56 (offer header).
 */
export type BankLogoSize = "xs" | "sm" | "md" | "lg";

const TILE: Record<BankLogoSize, { w: number; h: number }> = {
  xs: { w: 88, h: 32 },
  sm: { w: 112, h: 40 },
  md: { w: 140, h: 48 },
  lg: { w: 160, h: 56 }
};

// Tile padding is 6 px vertical, 10 px horizontal.
const PAD_X = 10;
const PAD_Y = 6;

/**
 * next/image only accepts absolute https URLs (next.config.js remotePatterns)
 * and site-relative paths; anything else (http://, data:, garbage typed in
 * the admin) would throw while rendering, so it falls back to the monogram.
 */
function isRenderableLogoUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && (url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//")));
}

export function BankLogo({
  name,
  logoUrl,
  size = "sm",
  grayscale = false,
  priority = false,
  className
}: {
  /** Bank name; used as the image alt text and for the monogram. */
  name: string;
  logoUrl?: string | null;
  size?: BankLogoSize;
  /** Ended offers: logo shown in grey. */
  grayscale?: boolean;
  /** Pass true for logos in the first visible cards (LCP), via the card's `index`. */
  priority?: boolean;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { w, h } = TILE[size];
  const failed = !isRenderableLogoUrl(logoUrl) || failedUrl === logoUrl;

  // A broken <img> can fire `error` before React hydrates and attaches
  // onError - catch that case by inspecting the element after mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img && logoUrl && !/\.svg(\?|#|$)/i.test(logoUrl) && img.complete && img.naturalWidth === 0) setFailedUrl(logoUrl);
  }, [logoUrl]);

  return (
    <span
      className={cn(
        "tile-scope inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-logo-tile ring-1 ring-line dark:brightness-[0.93]",
        grayscale && "grayscale",
        className
      )}
      style={{ width: w, height: h, padding: `${PAD_Y}px ${PAD_X}px` }}
    >
      {failed ? (
        <span
          role="img"
          aria-label={name}
          className="flex h-full w-full items-center justify-center rounded-md bg-ink-100 font-display text-[16px] font-semibold leading-none text-ink-700"
        >
          {bankMonogram(name)}
        </span>
      ) : (
        <Image
          ref={imgRef}
          src={logoUrl}
          alt={name}
          width={w - PAD_X * 2}
          height={h - PAD_Y * 2}
          priority={priority}
          className="h-full w-full object-contain"
          onError={() => setFailedUrl(logoUrl)}
        />
      )}
    </span>
  );
}
