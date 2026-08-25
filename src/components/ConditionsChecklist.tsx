"use client";

import { useState } from "react";
import { CheckSquare, Square } from "lucide-react";

interface Condition {
  id: string;
  title: string;
  description?: string | null;
}

export function ConditionsChecklist({ conditions }: { conditions: Condition[] }) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <ul className="space-y-2">
        {conditions.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => toggle(c.id)}
              className="flex w-full items-start gap-3 rounded-xl2 border border-ink-100 bg-surface p-4 text-left hover:border-teal-500"
              aria-pressed={checked.has(c.id)}
            >
              {checked.has(c.id) ? (
                <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
              ) : (
                <Square className="mt-0.5 h-5 w-5 shrink-0 text-ink-300" />
              )}
              <div>
                <p className="font-medium text-ink-900">{c.title}</p>
                {c.description && <p className="mt-1 text-sm text-ink-500">{c.description}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-500">
        Zaznaczanie kroków pomaga śledzić Twój postęp — nie jest przesyłane do banku ani do nas. Decydujące są
        zawsze terminy podane w regulaminie promocji, nie zaznaczone przez Ciebie pola.
      </p>
    </div>
  );
}
