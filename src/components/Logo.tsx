import { cn } from "@/lib/cn";

/**
 * The wordmark: "Bank" + "mi" (lighter) + "placi". One component for the header, the mobile
 * menu and the footer, so the logo cannot drift. The accessible name is the plain word.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-label="Bankmiplaci"
      className={cn("font-body font-bold leading-none tracking-[-0.035em] text-action", className)}
    >
      <span aria-hidden="true">
        Bank<span className="text-brand-soft" style={{ color: "rgb(var(--color-brand-soft))" }}>mi</span>placi
      </span>
    </span>
  );
}
