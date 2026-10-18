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
  md: "px-5 text-ui [--seg-pad:1.25rem]",
  sm: "relative px-3 text-small [--seg-pad:0.75rem] before:absolute before:inset-x-0 before:-inset-y-[4px] before:content-[''] sm:px-4 sm:[--seg-pad:1rem]"
};

const HEIGHT: Record<SegmentSize, string> = { md: "h-11", sm: "h-9" };

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

  // Two or more options are drawn as ONE joined pill: the outer ends are rounded, every shared edge is a
  // slanted cut (the middle options are parallelograms), the selected one sits on top of its neighbours.
  const joined = options.length >= 2;
  const last = options.length - 1;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex max-w-full", joined ? "flex-nowrap [--slant:12px]" : "flex-wrap gap-2", className)}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const isFirst = index === 0;
        const isLast = index === last;
        const button = (
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
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap border font-semibold",
              joined
                ? cn(
                    "relative",
                    checked ? "h-full" : "h-[calc(100%-5px)] shadow-[inset_0_3px_5px_rgb(0_0_0/0.14)]",
                    isFirst && "rounded-l-full",
                    isLast && "rounded-r-full",
                    !isFirst && "pl-[calc(var(--seg-pad)+var(--slant))]",
                    !isLast && "pr-[calc(var(--seg-pad)+var(--slant))]",
                    isFirst
                      ? "[clip-path:polygon(0_0,100%_0,calc(100%-var(--slant))_100%,0_100%)]"
                      : isLast
                        ? "[clip-path:polygon(var(--slant)_0,100%_0,100%_100%,0_100%)]"
                        : "[clip-path:polygon(var(--slant)_0,100%_0,calc(100%-var(--slant))_100%,0_100%)]"
                  )
                : cn("rounded-full", HEIGHT[size]),
              SIZE_CLASSES[size],
              "[transition:background-color_150ms_var(--ease-out,ease),border-color_150ms_var(--ease-out,ease),background-size_260ms_var(--ease-out,ease),transform_120ms_var(--ease-out,ease)]",
              joined && "motion-safe:active:scale-[0.97]",
              checked
                ? cn("border-action bg-action text-on-action", joined && "z-10")
                : cn(
                    "border-line-strong text-ink-700",
                    joined
                      ? "bg-sunken bg-[linear-gradient(rgb(var(--color-action)/0.16),rgb(var(--color-action)/0.16))] bg-[length:0%_100%] bg-left bg-no-repeat hover:border-action hover:bg-[length:100%_100%] hover:text-ink-900 motion-reduce:hover:bg-action/15"
                      : "bg-surface hover:bg-sunken"
                  )
            )}
          >
            {option.label}
            {option.count != null ? <span className="num font-medium">({option.count})</span> : null}
          </button>
        );
        if (!joined) return button;
        // Joined: the selected option stands ABOVE its neighbours (taller, with a soft shadow that a clip-path on the
        // button itself would cut off, hence the wrapper), the others sit a little lower and recessed, behind it.
        return (
          <span
            key={option.value}
            className={cn(
              "relative inline-flex items-end focus-within:z-30 hover:z-20",
              HEIGHT[size],
              !isFirst && "-ml-[calc(var(--slant)-2px)]",
              checked ? "z-10 [filter:drop-shadow(0_3px_4px_rgb(0_0_0/0.28))]" : "z-0"
            )}
          >
            {button}
          </span>
        );
      })}
    </div>
  );
}
