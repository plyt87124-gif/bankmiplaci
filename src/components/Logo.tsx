import { cn } from "@/lib/cn";

/**
 * The wordmark, taken 1:1 from the owner's chosen logo (option 3): "Bank" + "mi" (rose) + "placi".
 * Two transparent PNGs (public/logo): the original colours for the light theme and a recoloured one
 * for the dark theme (the dark burgundy would vanish on navy). One component for the header and the
 * footer, so the logo cannot drift. `height` is the rendered height in px (the width follows the ratio).
 */
export function Logo({ className, height = 28 }: { className?: string; height?: number }) {
  const width = Math.round((height * 848) / 182);
  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/bankmiplaci-light.png" alt="Bankmiplaci" width={width} height={height} className="block dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/bankmiplaci-dark.png" alt="" aria-hidden="true" width={width} height={height} className="hidden dark:block" />
    </span>
  );
}
