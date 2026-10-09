import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Native <select> with the shared `.select` look (same height/border/focus as
 * `.input`, plus a custom chevron). Native on purpose: best mobile pickers and
 * keyboard behaviour for free. Needs a visible <Label htmlFor>.
 */
export function Select({
  invalid,
  className,
  children,
  ...props
}: { invalid?: boolean } & ComponentProps<"select">) {
  return (
    <select
      {...props}
      aria-invalid={invalid ? true : props["aria-invalid"]}
      className={cn("select", className)}
    >
      {children}
    </select>
  );
}
