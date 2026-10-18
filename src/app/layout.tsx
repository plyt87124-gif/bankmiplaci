import type { Metadata, Viewport } from "next";
import { Exo_2, Inter, Lexend } from "next/font/google";
import "./globals.css";
import "@/styles/motion.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AdminSwitcher } from "@/components/AdminSwitcher";
import { AuthModalProvider } from "@/components/AuthModalProvider";
import { BlockedOffersProvider } from "@/components/BlockedOffers";
import { FontSwitch } from "@/components/FontSwitch";
import { CardTransitionBridge } from "@/components/CardTransitionBridge";
import { PageViewTracker } from "@/components/PageViewTracker";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/components/ui/theme";
import { siteName as resolveSiteName, siteUrl } from "@/lib/seo/siteUrl";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSwitchAccounts } from "@/lib/adminAccounts";
import { getCurrentUser } from "@/lib/userSession";

// Inter (variable): body text and the lead. Exo 2 (below): headlines, amounts, buttons. Both need the
// latin AND latin-ext subsets - ASCII lives in latin, Polish letters in latin-ext.
// Lexend: only for the (development-only) comparison switch - loaded lazily, used when <html data-font="lexend">.
const lexend = Lexend({ subsets: ["latin", "latin-ext"], variable: "--font-lexend", display: "swap", preload: false });
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
// Exo 2: the geometric, rounded-square face closest to the wordmark. Used for amounts, buttons, the menu,
// small labels and all headings (the "brand" voice); body text and the lead stay Inter.
const exo2 = Exo_2({ subsets: ["latin", "latin-ext"], variable: "--font-brand", weight: ["500", "600", "700"], display: "swap" });

// The origin and brand name come from the single SEO source (src/lib/seo/siteUrl.ts).
const siteName = resolveSiteName();

// No `openGraph.url` and no `robots` here on purpose: a site-wide og:url would
// point every subpage at the home page, and a layout-level robots value
// contradicts the per-page (and 404) robots directives. Pages set their own
// canonical/og:url (src/lib/seo, WP-02).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
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
  const [user, adminSession] = await Promise.all([getCurrentUser(), getServerSession(authOptions).catch(() => null)]);
  const switchAccounts = adminSession ? getSwitchAccounts() : [];
  const switchCurrent = switchAccounts.find((a) => a.email === user?.email.toLowerCase())?.key ?? null;

  return (
    <html lang="pl" className={`${inter.variable} ${exo2.variable} ${lexend.variable}`} suppressHydrationWarning>
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
        <CardTransitionBridge />
        <AuthModalProvider user={user ? { id: user.id, name: user.name } : null}>
          <BlockedOffersProvider>
            <Header />
            <main id="tresc" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </main>
            <Footer />
          </BlockedOffersProvider>
          {process.env.NODE_ENV !== "production" ? <FontSwitch /> : null}
          {adminSession ? (
            <AdminSwitcher options={switchAccounts.map(({ key, label }) => ({ key, label }))} current={switchCurrent} />
          ) : null}
        </AuthModalProvider>
      </body>
    </html>
  );
}
