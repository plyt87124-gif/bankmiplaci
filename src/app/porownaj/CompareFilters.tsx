"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export function CompareFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
      <input
        type="checkbox"
        defaultChecked={searchParams.get("hideBusiness") === "1"}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.checked) params.set("hideBusiness", "1");
          else params.delete("hideBusiness");
          startTransition(() => router.push(`${pathname}?${params.toString()}`));
        }}
      />
      Nie pokazuj kont firmowych
    </label>
  );
}
