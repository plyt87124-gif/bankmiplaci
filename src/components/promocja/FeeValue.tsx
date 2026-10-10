import { Money } from "@/components/ui/Money";
import { cn } from "@/lib/cn";
import type { FeeModel } from "@/lib/feeModel";

/**
 * A fee as one value, drawn from the shared fee model (src/lib/feeModel.ts):
 *
 *   unknown            "Brak danych" in the quiet colour - never 0 zł
 *   free + a caveat    "od 0 zł": 0 zł is the best case, "Inne opłaty" describes the catch
 *   anything else      the amount, as <Money> draws it everywhere
 *
 * The same words the FAQ and the JSON-LD use, so the page cannot call a fee
 * "0 zł" where its structured data says "od 0 zł".
 */
export function FeeValue({ fee, className }: { fee: FeeModel; className?: string }) {
  if (fee.kind === "free" && fee.hasCaveat) {
    return <span className={cn("num whitespace-nowrap font-body font-semibold", className)}>{fee.label}</span>;
  }
  return <Money cents={fee.cents} className={className} />;
}
