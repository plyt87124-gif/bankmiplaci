import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import "@/styles/motion.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthModalProvider } from "@/components/AuthModalProvider";
import { PageViewTracker } from "@/components/PageViewTracker";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/components/ui/theme";
import { getCurrentUser } from "@/lib/userSession";

// Source Serif 4 (variable, optical-size axis): only h1/h2, big amounts, lead
// text and the wordmark. Inter (variable): everything else. Both need the
// latin AND latin-ext subsets - ASCII lives in latin, Polish letters in latin-ext.
const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  axes: ["opsz"],
  display: "swap"
});
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "Bankmiplaci";

// No `openGraph.url` and no `robots` here on purpose: a site-wide og:url would
// point every subpage at the home page, and a layout-level robots value
// contradicts the per-page (and 404) robots directives. Pages set their own
// canonical/og:url (src/lib/seo, WP-02).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${siteName} — porównywarka promocji bankowych`, template: `%s | ${siteName}` },
  description:
    "Porównujemy aktualne promocje bankowe w Polsce: ile możesz otrzymać, co musisz zrobić i czy warto skorzystać.",
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark }
  ]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="pl" className={`${sourceSerif.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Blocking, runs before first paint: applies the saved theme (`dark`
            class) and enables entrance motion (`motion-ok`) unless the user
            prefers reduced motion. Inline, so it cannot be delayed by loading
            or caching; see components/ui/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#tresc"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-field focus:bg-action focus:px-4 focus:py-3 focus:font-semibold focus:text-on-action focus:shadow-pop"
        >
          Przejdź do treści
        </a>
        {/* Site-wide now (was previously bolted onto 5 individual pages,
            missing everything else - blog, FAQ, konto, legal pages...),
            which is also what feeds User.lastActiveAt for the admin
            "aktywny/a" dot on every page, not just promotion pages. */}
        <PageViewTracker />
        <AuthModalProvider>
          <Header user={user} />
          <main id="tresc" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <Footer />
        </AuthModalProvider>
      </body>
    </html>
  );
}
