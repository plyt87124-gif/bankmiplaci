import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` = clsx + tailwind-merge, taught the custom utilities from
 * tailwind.config.ts. Without this, tailwind-merge would classify
 * `text-h1`/`text-caption` as TEXT COLOURS and silently drop one of
 * `cn("text-caption", "text-ink-700")`.
 * Keep the lists below in sync with fontSize/borderRadius/boxShadow/
 * fontFamily/transition* in tailwind.config.ts.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "stat",
            "stat-lg",
            "amount",
            "h1",
            "h1-lg",
            "h2",
            "h2-lg",
            "h3",
            "h4",
            "lead",
            "lead-lg",
            "article",
            "article-lg",
            "ui",
            "small",
            "caption",
            "label"
          ]
        }
      ],
      "font-family": [{ font: ["display", "body", "amount"] }],
      rounded: [{ rounded: ["xl2", "field", "card"] }],
      shadow: [{ shadow: ["pop", "modal", "card", "cardHover"] }],
      duration: [{ duration: ["fast", "base", "accordion", "reveal"] }],
      ease: [{ ease: ["inOut"] }]
    }
  }
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
