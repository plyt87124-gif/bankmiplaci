"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "", label: "Wszystkie" },
  { value: "PERSONAL", label: "Osobiste" },
  { value: "BUSINESS", label: "Firmowe" }
];

const COUNT_OPTIONS = ["4", "8", "12", "all"];

export function CompareFilters({ maxCount }: { maxCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentAccountType = searchParams.get("typ") ?? "";
  const currentCount = searchParams.get("liczba") ?? "8";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-500">Typ konta:</span>
        <div className="flex rounded-full border border-ink-100 bg-surface p-1">
          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setParam("typ", opt.value)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                currentAccountType === opt.value ? "bg-ink-solid text-white" : "text-ink-700 hover:bg-ink-100"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-500">Pokaż:</span>
        <div className="flex rounded-full border border-ink-100 bg-surface p-1">
          {COUNT_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setParam("liczba", opt === "8" ? "" : opt)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                currentCount === opt ? "bg-ink-solid text-white" : "text-ink-700 hover:bg-ink-100"
              )}
            >
              {opt === "all" ? `Wszystkie (${maxCount})` : opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
