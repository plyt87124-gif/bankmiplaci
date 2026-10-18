import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FormMessage } from "@/components/ui/FormMessage";
import { Label } from "@/components/ui/Label";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
}

/**
 * Label + control + hint + error wired together (ids, aria-describedby,
 * aria-invalid) so no form has to do it by hand:
 *
 *   <Field label="E-mail" hint="Na ten adres wyślemy link." error={errors.email} required>
 *     {(control) => <Input type="email" autoComplete="email" {...control} />}
 *   </Field>
 *
 * Works in server and client components (only `useId`).
 */
export function Field({
  label,
  hint,
  error,
  required,
  srOnlyLabel,
  className,
  children
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  srOnlyLabel?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("w-full", className)}>
      <Label htmlFor={id} required={required} srOnly={srOnlyLabel}>
        {label}
      </Label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required || undefined
      })}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-caption text-ink-500">
          {hint}
        </p>
      ) : null}
      <FormMessage id={errorId}>{error}</FormMessage>
    </div>
  );
}
