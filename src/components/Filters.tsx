"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { Difficulty, AccountType } from "@prisma/client";
import { DIFFICULTY_LABEL, ACCOUNT_TYPE_LABEL } from "@/lib/format";

const DIFFICULTIES: Difficulty[] = ["VERY_EASY", "EASY", "MEDIUM", "HARD"];
const ACCOUNT_TYPES: AccountType[] = ["PERSONAL", "SAVINGS", "YOUNG", "BUSINESS", "JOINT"];
const SORTS: { value: string; label: string }[] = [
  { value: "top-rated", label: "Najlepsza ocena" },
  { value: "highest-bonus", label: "Najwyższa premia" },
  { value: "easiest", label: "Najłatwiejsze" },
  { value: "newest", label: "Najnowsze" },
  { value: "ending-soon", label: "Kończące się wkrótce" }
];

export function Filters({ banks }: { banks: { slug: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams]
  );

  const toggleDifficulty = (value: string) => {
    const current = new Set(searchParams.get("difficulty")?.split(",").filter(Boolean));
    if (current.has(value)) current.delete(value);
    else current.add(value);
    update("difficulty", current.size ? Array.from(current).join(",") : null);
  };

  const activeDifficulties = new Set(searchParams.get("difficulty")?.split(",").filter(Boolean));

  return (
    <aside className="space-y-6 rounded-xl2 border border-ink-100 bg-surface p-5">
      <div>
        <p className="text-sm font-semibold text-ink-900">Sortuj</p>
        <select
          className="mt-2 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
          defaultValue={searchParams.get("sort") ?? "top-rated"}
          onChange={(e) => update("sort", e.target.value)}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-900">Poziom trudności</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDifficulty(d)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                activeDifficulties.has(d)
                  ? "border-ink-solid bg-ink-solid text-white"
                  : "border-ink-100 bg-paper text-ink-700"
              }`}
            >
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-900">Bank</p>
        <select
          className="mt-2 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
          defaultValue={searchParams.get("bank") ?? ""}
          onChange={(e) => update("bank", e.target.value || null)}
        >
          <option value="">Wszystkie banki</option>
          {banks.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-900">Typ konta</p>
        <select
          className="mt-2 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
          defaultValue={searchParams.get("accountType") ?? ""}
          onChange={(e) => update("accountType", e.target.value || null)}
        >
          <option value="">Wszystkie</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-900">Minimalna premia</p>
        <select
          className="mt-2 w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
          defaultValue={searchParams.get("minBonus") ?? ""}
          onChange={(e) => update("minBonus", e.target.value || null)}
        >
          <option value="">Dowolna</option>
          <option value="20000">od 200 zł</option>
          <option value="50000">od 500 zł</option>
          <option value="100000">od 1000 zł</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          defaultChecked={searchParams.get("noFees") === "1"}
          onChange={(e) => update("noFees", e.target.checked ? "1" : null)}
        />
        Tylko bez opłaty za prowadzenie konta
      </label>
    </aside>
  );
}
