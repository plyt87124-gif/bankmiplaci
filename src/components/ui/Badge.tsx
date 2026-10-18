import { Clock, Info, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Status badge (spec section 5): 24 px high, radius 6, 13 px / 600, icon 14 px
 * or a dot. Colour never carries the meaning alone - every badge has a word,
 * and the warn/verified/outline variants also get their icon by default.
 *
 *   neutral   account type, difficulty, "Zweryfikowano"
 *   verified  teal tint + ShieldCheck
 *   success   "Bez opłat za konto" - ONLY for an unconditional 0 zł, without a footnote
 *   warn      "Koniec za N dni" (<= 14 days) + Clock
 *   danger    "Koniec za N dni" (<= 3 days) or "Zakończona"
 *   info      "Zaktualizowano"
 *   reward    checklist / earnings counter only
 *   outline   "Link partnerski" + Info
 *
 * `tone` (teal | gold | coral | neutral) is the LEGACY prop of the pre-v2
 * Badge; it maps onto the new variants and adds no icon.
 */
export type BadgeVariant = "neutral" | "verified" | "success" | "warn" | "danger" | "info" | "reward" | "outline";
type LegacyTone = "teal" | "gold" | "coral" | "neutral";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-ink-100 text-ink-700",
  verified: "bg-teal-100 text-teal-700",
  success: "bg-success-100 text-success",
  warn: "bg-warn-100 text-warn",
  danger: "bg-coral-100 text-coral-600",
  info: "bg-info-100 text-info",
  reward: "bg-gold-100 text-gold-600",
  outline: "border border-line-strong bg-transparent text-ink-700"
};

const defaultIcons: Partial<Record<BadgeVariant, LucideIcon>> = {
  verified: ShieldCheck,
  warn: Clock,
  outline: Info
};

const legacyTone: Record<LegacyTone, BadgeVariant> = {
  teal: "verified",
  gold: "reward",
  coral: "danger",
  neutral: "neutral"
};

export function Badge({
  variant,
  tone,
  icon,
  dot = false,
  className,
  children
}: {
  variant?: BadgeVariant;
  /** @deprecated Use `variant`. */
  tone?: LegacyTone;
  /** A lucide icon component, or `false` to drop the variant's default icon. */
  icon?: LucideIcon | false;
  /** Small filled dot instead of an icon. */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const resolved: BadgeVariant = variant ?? (tone ? legacyTone[tone] : "neutral");
  // Defaults only apply to the new `variant` API, so legacy callers that already
  // put their own icon inside `children` don't end up with two.
  const Icon = icon === false || dot ? null : (icon ?? (variant ? defaultIcons[variant] : undefined)) ?? null;

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 font-brand text-caption font-semibold",
        variants[resolved],
        className
      )}
    >
      {dot ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /> : null}
      {Icon ? <Icon size={14} aria-hidden="true" className="shrink-0" /> : null}
      {children}
    </span>
  );
}
