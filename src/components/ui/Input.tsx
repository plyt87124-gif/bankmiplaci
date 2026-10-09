import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Text-like field (`.input` from globals.css: h-12, line-strong border, 10 px
 * radius, action-coloured focus ring). Use `className="h-11"` in dense
 * toolbars (filter bar). `invalid` sets aria-invalid, which also paints the
 * coral border - pair it with <FormMessage id=...> and `aria-describedby`.
 * Always render a visible <Label htmlFor> (or an sr-only one for search boxes).
 */
export function Input({
  invalid,
  className,
  ...props
}: { invalid?: boolean } & ComponentProps<"input">) {
  return (
    <input
      {...props}
      aria-invalid={invalid ? true : props["aria-invalid"]}
      className={cn("input", className)}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...props
}: { invalid?: boolean } & ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid ? true : props["aria-invalid"]}
      className={cn("input", className)}
    />
  );
}
