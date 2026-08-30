import type { Config } from "tailwindcss";

// Design tokens for "Premia" — a Polish bank-promotion comparator.
// Palette deliberately avoids the generic warm-cream/terracotta AI default:
// cool paper background, deep ink navy, a confident teal-green "money" accent,
// and a muted gold reserved only for the top-rated badge.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: {
          900: "rgb(var(--color-ink-900) / <alpha-value>)",
          700: "rgb(var(--color-ink-700) / <alpha-value>)",
          500: "rgb(var(--color-ink-500) / <alpha-value>)",
          300: "rgb(var(--color-ink-300) / <alpha-value>)",
          100: "rgb(var(--color-ink-100) / <alpha-value>)",
          solid: "rgb(var(--color-ink-solid) / <alpha-value>)"
        },
        teal: {
          700: "rgb(var(--color-teal-700) / <alpha-value>)",
          600: "rgb(var(--color-teal-600) / <alpha-value>)",
          500: "rgb(var(--color-teal-500) / <alpha-value>)",
          100: "rgb(var(--color-teal-100) / <alpha-value>)"
        },
        gold: {
          600: "rgb(var(--color-gold-600) / <alpha-value>)",
          100: "rgb(var(--color-gold-100) / <alpha-value>)"
        },
        coral: {
          600: "rgb(var(--color-coral-600) / <alpha-value>)",
          100: "rgb(var(--color-coral-100) / <alpha-value>)"
        }
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,27,42,0.04), 0 8px 24px -12px rgba(14,27,42,0.12)",
        cardHover: "0 2px 4px rgba(14,27,42,0.06), 0 16px 32px -12px rgba(14,27,42,0.16)"
      },
      // Only powers the `article-body` class (blog post Markdown) — deliberately
      // NOT the plugin's default `prose` class, which stays inert everywhere
      // else in the app (e.g. LegalPage.tsx's hand-rolled `[&_h2]:...` overrides
      // must keep working exactly as before).
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "rgb(var(--color-ink-700))",
            "--tw-prose-headings": "rgb(var(--color-ink-900))",
            "--tw-prose-bold": "rgb(var(--color-ink-900))",
            "--tw-prose-links": "rgb(var(--color-teal-700))",
            "--tw-prose-bullets": "rgb(var(--color-ink-300))",
            "--tw-prose-hr": "rgb(var(--color-ink-100))",
            "--tw-prose-th-borders": "rgb(var(--color-ink-100))",
            "--tw-prose-td-borders": "rgb(var(--color-ink-100))",
            "--tw-prose-quotes": "rgb(var(--color-ink-700))",
            "--tw-prose-quote-borders": "rgb(var(--color-teal-100))",
            maxWidth: "none",
            "h1, h2, h3, h4": { fontFamily: "var(--font-fraunces), Georgia, serif" }
          }
        }
      }
    }
  },
  plugins: [require("@tailwindcss/typography")({ className: "article-body" })]
};
export default config;
