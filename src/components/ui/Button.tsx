import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PILL_OFF, PILL_ON } from "@/components/ui/pillStyles";

/**
 * The ONE button implementation (spec section 5). All pills, in the look of the Segment the owner picked as the
 * favourite (see pillStyles.ts). Variants:
 *  - primary    ON: SOLID action fill, bold on-action label, soft drop shadow (= the selected Segment)
 *  - cta        primary + a halo and a stronger glow + ArrowRight: the loudest button. ONLY for links that leave for a
 *               bank (/out/...), always followed by <AffiliateDisclosure variant="compact">
 *  - secondary  OFF: cream fill, line-strong border, ink text; hover washes in the action tint (= the other Segment tab)
 *  - ghost      text button, hover fill
 *  - danger     coral-600 fill, text-on-coral
 * Sizes: sm (36 px, hit area padded to 44), md (44 px), lg (56 px) - min-heights.
 * Disabled = grey fill + ink-500 text + hairline border (never opacity).
 */
export type ButtonVariant = "primary" | "cta" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group/cta relative inline-flex select-none items-center justify-center gap-2 rounded-full border border-transparent text-center font-brand font-semibold " +
  "[transition:background-color_150ms_var(--ease-out,ease),border-color_150ms_var(--ease-out,ease),transform_120ms_var(--ease-out,ease)] " +
  "active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

// Primary = the selected Segment tab: solid action fill + soft drop shadow (PILL_ON), a darker fill on hover / press.
const PRIMARY = `${PILL_ON} hover:border-action-hover hover:bg-action-hover active:bg-action-hover`;

// The loudest button, only for the link that leaves for a bank ("Przejdź do promocji"). It is the primary look plus a
// 4 px halo of the action hue and a wide glow underneath, so even next to other solid buttons it is the first thing the
// eye lands on. Both live in ONE box-shadow, so `shadow-none` on a disabled button removes the halo with it.
const CTA =
  "border-action bg-action text-on-action shadow-[0_0_0_4px_rgb(var(--color-action)/0.2),0_12px_28px_-8px_rgb(var(--color-action)/0.75)] hover:border-action-hover hover:bg-action-hover active:bg-action-hover";

const variants: Record<ButtonVariant, string> = {
  primary: PRIMARY,
  cta: CTA,
  secondary: PILL_OFF,
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100",
  danger: "bg-coral-600 text-on-coral hover:bg-coral-600/90"
};

// Heights are MINIMUMS (36 / 44 / 56 px): a one-line label gets exactly the spec
// height, while a long label wraps instead of overflowing a narrow phone screen
// (a nowrap button inside a grid column widens the whole column).
const sizes: Record<ButtonSize, string> = {
  // The extra ::before enlarges the pointer hit area to 44 px without growing the button.
  sm: "min-h-9 px-4 py-1.5 text-small before:absolute before:inset-x-0 before:-inset-y-[4px] before:content-['']",
  md: "min-h-11 px-5 py-2 text-ui",
  lg: "min-h-14 px-8 py-3 text-[17px]"
};

const disabledClasses =
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-ink-100 disabled:bg-none disabled:text-ink-500 disabled:shadow-none disabled:active:scale-100 " +
  "aria-disabled:cursor-not-allowed aria-disabled:border-line aria-disabled:bg-ink-100 aria-disabled:bg-none aria-disabled:text-ink-500 aria-disabled:shadow-none aria-disabled:active:scale-100";

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the container. */
  fullWidth?: boolean;
}

/** Class string of a button, for places that need an <a> or custom element styled as one. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  disabled,
  className
}: ButtonOwnProps & { disabled?: boolean; className?: string } = {}): string {
  return cn(
    base,
    variants[variant],
    sizes[size],
    disabled ? "cursor-not-allowed border-line bg-ink-100 text-ink-500 shadow-none hover:border-line hover:bg-ink-100 hover:bg-none active:scale-100" : null,
    fullWidth ? "w-full" : null,
    className
  );
}

function CtaArrow() {
  return <ArrowRight size={18} aria-hidden="true" className="shrink-0 transition-transform duration-200 ease-out group-hover/cta:translate-x-1 group-focus-visible/cta:translate-x-1 motion-reduce:transition-none" />;
}

function Spinner() {
  return <Loader2 size={16} aria-hidden="true" className="shrink-0 animate-spin" />;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonOwnProps & { loading?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      // While loading the button keeps its normal look but ignores clicks.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        loading ? "cursor-progress" : disabledClasses,
        fullWidth ? "w-full" : null,
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
      {variant === "cta" && !loading ? <CtaArrow /> : null}
    </button>
  );
}

type ButtonLinkProps = ButtonOwnProps & { children?: ReactNode } & Omit<ComponentProps<typeof Link>, "children">;

/**
 * A link styled as a button (Next <Link>). A "disabled" link (e.g. the CTA of
 * an expired offer) is not a link at all: pass `disabled` and it renders an
 * `aria-disabled` <span> without href, so it cannot be followed or tabbed to.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth,
  disabled,
  className,
  href,
  children,
  ...props
}: ButtonLinkProps & { disabled?: boolean }) {
  const classes = cn(
    base,
    variants[variant],
    sizes[size],
    disabled ? "pointer-events-none cursor-not-allowed border-line bg-ink-100 bg-none text-ink-500 shadow-none" : null,
    fullWidth ? "w-full" : null,
    className
  );
  const content = (
    <>
      {children}
      {variant === "cta" ? <CtaArrow /> : null}
    </>
  );

  if (disabled) {
    return (
      <span role="link" aria-disabled="true" className={classes}>
        {content}
      </span>
    );
  }

  return (
    // A "cta" link leaves for a bank through /out/..., which records the click:
    // a prefetch must never trigger that, so it is off unless a caller opts in.
    <Link href={href} className={classes} prefetch={variant === "cta" ? false : undefined} {...props}>
      {content}
    </Link>
  );
}
