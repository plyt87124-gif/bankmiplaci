import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Message under a field or form. The meaning is carried by the icon and the
 * words, colour only supports it:
 *   error   -> role="alert"   (announced at once)
 *   success -> role="status"
 *   info / warning -> role="status"
 * Give it an `id` and reference it from the field's `aria-describedby`.
 * Renders nothing when there are no children, so it is safe to leave in place.
 */
export type FormMessageTone = "error" | "success" | "info" | "warning";

const toneStyles: Record<FormMessageTone, { icon: typeof Info; text: string; role: "alert" | "status" }> = {
  error: { icon: AlertCircle, text: "text-coral-600", role: "alert" },
  success: { icon: CheckCircle2, text: "text-success", role: "status" },
  info: { icon: Info, text: "text-info", role: "status" },
  warning: { icon: TriangleAlert, text: "text-warn", role: "status" }
};

export function FormMessage({
  tone = "error",
  id,
  className,
  children
}: {
  tone?: FormMessageTone;
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (children == null || children === false || children === "") return null;
  const { icon: Icon, text, role } = toneStyles[tone];

  return (
    <p id={id} role={role} className={cn("mt-1.5 flex items-start gap-1.5 text-caption font-medium", text, className)}>
      <Icon size={16} aria-hidden="true" className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}
