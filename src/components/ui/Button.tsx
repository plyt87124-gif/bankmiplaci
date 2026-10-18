import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The ONE button implementation (spec section 5). Variants:
 *  - primary    bg-action / text-on-action
 *  - cta        primary + ArrowRight. ONLY for links that leave for a bank
 *               (/out/...), always followed by <AffiliateDisclosure variant="compact">
 *  - secondary  surface + line-strong border
 *  - ghost      text button, hover fill
 *  - danger     coral-600 fill, text-on-coral
 * Sizes: sm (36 px, hit area padded to 44), md (44 px), lg (56 px) - min-heights.
 * Disabled = grey fill + ink-500 text + hairline border (never opacity).
 */
export type ButtonVariant = "primary" | "cta" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group/cta relative inline-flex select-none items-center justify-center gap-2 rounded-field border border-transparent text-center font-brand font-semibold " +
  "[transition:background-color_150ms_var(--ease-out,ease),border-color_150ms_var(--ease-out,ease),transform_120ms_var(--ease-out,ease)] " +
  "active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-action text-on-action hover:bg-action-hover",
  cta: "bg-action text-on-action hover:bg-action-hover",
  secondary: "border-line-strong bg-surface text-ink-900 hover:bg-sunken",
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
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-ink-100 disabled:text-ink-500 disabled:active:scale-100 " +
  "aria-disabled:cursor-not-allowed aria-disabled:border-line aria-disabled:bg-ink-100 aria-disabled:text-ink-500 aria-disabled:active:scale-100";

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
    disabled ? "cursor-not-allowed border-line bg-ink-100 text-ink-500 hover:bg-ink-100 active:scale-100" : null,
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
    disabled ? "pointer-events-none cursor-not-allowed border-line bg-ink-100 text-ink-500" : null,
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
