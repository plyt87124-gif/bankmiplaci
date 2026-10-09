"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Optional count shown after the label, e.g. number of offers. */
  count?: number;
}

/**
 * Pill-shaped single-choice control (Wszystkie / Osobiste / Firmowe,
 * Konta osobiste / Konta firmowe) as a WAI-ARIA radiogroup: one tab stop,
 * arrow keys move AND select, Home/End jump. Controlled: the parent owns
 * `value` (state or URL) and reacts in `onChange`.
 * Active = action fill; inactive = outlined. 44 px high (touch target).
 */
export function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
  className
}: {
  /** Accessible name of the group, e.g. "Typ konta". */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  // If `value` matches nothing, the first option is the tab stop.
  const tabStopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function move(toIndex: number) {
    const target = options[toIndex];
    if (!target) return;
    onChange(target.value);
    refs.current[toIndex]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(index === last ? 0 : index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(index === 0 ? last : index - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(last);
        break;
    }
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full flex-wrap gap-2", className)}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStopIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-5 text-ui font-semibold",
              "[transition:background-color_150ms_var(--ease-out,ease),border-color_150ms_var(--ease-out,ease)]",
              checked
                ? "border-action bg-action text-on-action"
                : "border-line-strong bg-surface text-ink-700 hover:bg-sunken"
            )}
          >
            {option.label}
            {option.count != null ? <span className="num font-medium">({option.count})</span> : null}
          </button>
        );
      })}
    </div>
  );
}
