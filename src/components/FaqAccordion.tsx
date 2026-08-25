"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-ink-100 rounded-xl2 border border-ink-100 bg-surface">
      {items.map((item, i) => (
        <div key={item.question}>
          <button
            className="flex w-full items-center justify-between gap-4 p-5 text-left"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span className="font-medium text-ink-900">{item.question}</span>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-ink-300 transition-transform", open === i && "rotate-180")} />
          </button>
          {open === i && <p className="px-5 pb-5 text-sm text-ink-500">{item.answer}</p>}
        </div>
      ))}
    </div>
  );
}
