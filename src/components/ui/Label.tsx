import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Visible field label. `required` appends an asterisk marked aria-hidden plus
 * a screen-reader "(wymagane)" - and does NOT replace the native `required`
 * attribute on the field itself. Use `srOnly` for fields whose purpose is
 * obvious from the surrounding UI (a search box) - a label must still exist.
 */
export function Label({
  required,
  srOnly,
  className,
  children,
  ...props
}: { required?: boolean; srOnly?: boolean } & ComponentProps<"label">) {
  return (
    <label
      className={cn(srOnly ? "sr-only" : "mb-1.5 block text-small font-semibold text-ink-900", className)}
      {...props}
    >
      {children}
      {required ? (
        <>
          <span aria-hidden="true" className="ml-0.5 text-coral-600">
            *
          </span>
          <span className="sr-only"> (wymagane)</span>
        </>
      ) : null}
    </label>
  );
}
