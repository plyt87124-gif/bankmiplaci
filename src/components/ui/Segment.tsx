"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Optional count shown after the label, e.g. number of offers. */
  count?: number;
}

export type SegmentSize = "md" | "sm";

const SIZE_CLASSES: Record<SegmentSize, string> = {
  md: "h-11 px-5 text-ui",
  sm: "relative h-9 px-3 text-small before:absolute before:inset-x-0 before:-inset-y-[4px] before:content-[''] sm:px-4"
};

/**
 * Pill-shaped single-choice control (Wszystkie / Osobiste / Firmowe,
 * Konta osobiste / Konta firmowe) as a WAI-ARIA radiogroup: one tab stop,
 * arrow keys move AND select, Home/End jump. Controlled: the parent owns
 * `value` (state or URL) and reacts in `onChange`.
 * Active = action fill; inactive = outlined. 44 px high (touch target).
 *
 * `size="sm"` is the compact variant for tight toolbars (the /promocje list on
 * a phone): 36 px high, less padding, 14 px text, and a ::before that grows
 * the pointer hit area to 44 px without growing the button (same trick as
 * Button size sm). "Wszystkie (23) / Osobiste (14) / Firmowe (7)" then needs
 * about 380 px: one row from ~410 px, and on narrower phones two rows of 36 px
 * (320 px used to need three rows of 44 px).
 */
export function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className
}: {
  /** Accessible name of the group, e.g. "Typ konta". */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentSize;
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
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border font-semibold",
              SIZE_CLASSES[size],
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
