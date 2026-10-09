import type { Config } from "tailwindcss";

/**
 * Design tokens "Papier i tusz" (v2) - docs/redesign-v2/01-design-spec.md.
 *
 * Every colour is an RGB triple CSS variable defined in src/app/globals.css
 * (`:root` = light, `.dark` = dark), so `bg-action/25` style opacity
 * modifiers work and the dark theme needs no `dark:` variants for colour.
 *
 * Semantic roles (use these in new code):
 *   paper / surface / sunken      page background / cards+fields / info blocks
 *   ink-900..400                  text (ink-300 = icons and decoration ONLY)
 *   line / line-strong            card borders+separators / form-control borders
 *   action / action-hover / on-action / focus-ring   the one action colour
 *   success, info, warn (= gold-600), coral-600 (error)  + their -100 tints
 *
 * LEGACY names kept so not-yet-migrated files still compile and render in
 * the new palette: ink-solid, teal-*, gold-*, coral-*, `border-ink-100`
 * (aliased to `line`, see borderColor/divideColor below), shadow-card,
 * shadow-cardHover, rounded-xl2, font-mono. Migration rules: spec section 7.
 */
const rgb = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  // `hover:` utilities apply only on devices that can really hover (no sticky
  // hover states after a tap on touch screens).
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        paper: rgb("paper"),
        surface: rgb("surface"),
        sunken: rgb("sunken"),
        ink: {
          900: rgb("ink-900"),
          700: rgb("ink-700"),
          500: rgb("ink-500"),
          400: rgb("ink-400"),
          300: rgb("ink-300"),
          100: rgb("ink-100"),
          // LEGACY - fixed dark plate, does not flip with the theme. Admin and
          // not-yet-migrated code only; use <Button> / bg-action in new code.
          solid: rgb("ink-solid")
        },
        line: { DEFAULT: rgb("line"), strong: rgb("line-strong") },
        action: { DEFAULT: rgb("action"), hover: rgb("action-hover") },
        "on-action": rgb("on-action"),
        "focus-ring": rgb("focus-ring"),
        "logo-tile": rgb("logo-tile"),
        teal: {
          700: rgb("teal-700"),
          600: rgb("teal-600"),
          500: rgb("teal-500"),
          100: rgb("teal-100")
        },
        gold: {
          600: rgb("gold-600"),
          500: rgb("gold-500"),
          100: rgb("gold-100")
        },
        // `warn` is a semantic alias of the gold family (text-warn, bg-warn-100).
        warn: { DEFAULT: rgb("gold-600"), 100: rgb("gold-100") },
        coral: {
          600: rgb("coral-600"),
          100: rgb("coral-100")
        },
        // Text/icon colour on a solid coral-600 fill (danger button).
        "on-coral": rgb("on-coral"),
        success: { DEFAULT: rgb("success"), 100: rgb("success-100") },
        info: { DEFAULT: rgb("info"), 100: rgb("info-100") }
      },
      // LEGACY alias: `border-ink-100` / `divide-ink-100` on not-yet-migrated
      // cards now resolve to the hairline `line` colour (ink-100 is a FILL
      // colour in v2). New code uses border-line / border-line-strong.
      borderColor: { ink: { 100: rgb("line") } },
      divideColor: { ink: { 100: rgb("line") } },
      fontFamily: {
        // The inline fallback inside var() keeps text styled even where the
        // next/font variable is missing (global-error.tsx renders no layout).
        display: ["var(--font-display, Georgia)", "Georgia", "serif"],
        body: ["var(--font-body, system-ui)", "system-ui", "sans-serif"],
        // Big amounts (card, offer hero). One token: switch it in globals.css
        // (`--font-amount: var(--font-body)`) to move all amounts to Inter.
        amount: ["var(--font-amount, Georgia)", "Georgia", "serif"],
        // No webfont for code (promo codes etc.) - system monospace stack.
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
      },
      // Type scale (spec section 3). Mobile value under the plain key,
      // desktop step under `<key>-lg` (use `text-h1 md:text-h1-lg`, or just the
      // `.type-*` classes from globals.css which already combine them).
      fontSize: {
        stat: ["2.75rem", { lineHeight: "2.875rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        "stat-lg": ["3.5rem", { lineHeight: "3.625rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        amount: ["2.25rem", { lineHeight: "2.5rem", fontWeight: "600" }],
        h1: ["2rem", { lineHeight: "2.375rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        "h1-lg": ["2.5rem", { lineHeight: "2.875rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        h2: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        "h2-lg": ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        h4: ["1.0625rem", { lineHeight: "1.625rem", fontWeight: "600" }],
        lead: ["1.1875rem", { lineHeight: "1.875rem", fontWeight: "400" }],
        "lead-lg": ["1.3125rem", { lineHeight: "2rem", fontWeight: "400" }],
        article: ["1.0625rem", { lineHeight: "1.75rem" }],
        "article-lg": ["1.125rem", { lineHeight: "1.875rem" }],
        ui: ["1rem", { lineHeight: "1.625rem" }],
        small: ["0.875rem", { lineHeight: "1.375rem" }],
        // 13 px is the MINIMUM size for informational text.
        caption: ["0.8125rem", { lineHeight: "1.125rem" }],
        label: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.06em", fontWeight: "600" }]
      },
      borderRadius: {
        // LEGACY (old cards). v2 radii: 6 badge, 8 logo tile/chip, 10 button+field, 14 card, 16 modal.
        xl2: "1.25rem",
        field: "0.625rem",
        card: "0.875rem"
      },
      boxShadow: {
        // Flat system: cards have NO shadow. Only floating layers get one.
        // Values live in globals.css (:root / .dark) so the dark theme gets its own, deeper shadow.
        pop: "var(--shadow-pop, 0 6px 20px -6px rgb(26 28 32 / 0.18))",
        modal: "var(--shadow-modal, 0 12px 40px -12px rgb(26 28 32 / 0.28))",
        // LEGACY - kept (very subtle) for not-yet-migrated cards.
        card: "0 1px 2px rgb(26 28 32 / 0.04)",
        cardHover: "0 1px 2px rgb(26 28 32 / 0.06)"
      },
      transitionTimingFunction: {
        out: "var(--ease-out, cubic-bezier(0.22, 0.61, 0.36, 1))",
        inOut: "var(--ease-in-out, cubic-bezier(0.4, 0, 0.2, 1))"
      },
      transitionDuration: {
        fast: "var(--dur-fast, 120ms)",
        base: "var(--dur-base, 200ms)",
        accordion: "var(--dur-accordion, 250ms)",
        reveal: "var(--dur-reveal, 400ms)"
      },
      // Only powers the `article-body` class (blog post Markdown) - deliberately
      // NOT the plugin's default `prose` class, which stays inert everywhere
      // else in the app (e.g. LegalPage.tsx's hand-rolled `[&_h2]:...` overrides
      // must keep working exactly as before).
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "rgb(var(--color-ink-700))",
            "--tw-prose-headings": "rgb(var(--color-ink-900))",
            "--tw-prose-lead": "rgb(var(--color-ink-700))",
            "--tw-prose-links": "rgb(var(--color-action))",
            "--tw-prose-bold": "rgb(var(--color-ink-900))",
            "--tw-prose-counters": "rgb(var(--color-ink-500))",
            "--tw-prose-bullets": "rgb(var(--color-ink-400))",
            "--tw-prose-hr": "rgb(var(--color-line))",
            "--tw-prose-quotes": "rgb(var(--color-ink-700))",
            "--tw-prose-quote-borders": "rgb(var(--color-line-strong))",
            "--tw-prose-captions": "rgb(var(--color-ink-500))",
            "--tw-prose-code": "rgb(var(--color-ink-900))",
            "--tw-prose-pre-code": "rgb(var(--color-ink-700))",
            "--tw-prose-pre-bg": "rgb(var(--color-sunken))",
            "--tw-prose-th-borders": "rgb(var(--color-line-strong))",
            "--tw-prose-td-borders": "rgb(var(--color-line))",
            maxWidth: "none",
            // Reading text: 17/28, links underlined (offset 3 px, action colour).
            fontSize: "1.0625rem",
            lineHeight: "1.65",
            "h1, h2": { fontFamily: "var(--font-display, Georgia), Georgia, serif", fontWeight: "600" },
            "h3, h4": { fontFamily: "var(--font-body, system-ui), system-ui, sans-serif", fontWeight: "600" },
            a: { textDecorationLine: "underline", textUnderlineOffset: "3px", fontWeight: "500" },
            blockquote: {
              fontStyle: "normal",
              fontWeight: "400",
              backgroundColor: "rgb(var(--color-sunken))",
              borderInlineStartColor: "rgb(var(--color-line-strong))",
              padding: "0.75rem 1.25rem",
              quotes: "none"
            },
            "blockquote p:first-of-type::before": { content: "none" },
            "blockquote p:last-of-type::after": { content: "none" },
            "thead th": { backgroundColor: "rgb(var(--color-sunken))" }
          }
        }
      }
    }
  },
  plugins: [require("@tailwindcss/typography")({ className: "article-body" })]
};
export default config;
