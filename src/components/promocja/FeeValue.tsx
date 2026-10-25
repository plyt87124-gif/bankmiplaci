import { Money } from "@/components/ui/Money";
import { cn } from "@/lib/cn";
import type { FeeModel } from "@/lib/feeModel";

/**
 * A fee as one value, drawn from the shared fee model (src/lib/feeModel.ts):
 *
 *   unknown            "Brak danych" in the quiet colour - never 0 zł
 *   anything else      the amount, as <Money> draws it everywhere
 *
 * The same words the FAQ and the JSON-LD use. ("od 0 zł" is retired: a free fee is always plain "0 zł".)
 */
export function FeeValue({ fee, className }: { fee: FeeModel; className?: string }) {
  if (fee.kind === "free" && fee.hasCaveat) {
    return <span className={cn("num whitespace-nowrap font-body font-semibold", className)}>{fee.label}</span>;
  }
  return <Money cents={fee.cents} className={className} />;
}
