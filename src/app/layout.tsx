import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthModalProvider } from "@/components/AuthModalProvider";
import { getCurrentUser } from "@/lib/userSession";

const fraunces = Fraunces({
  subsets: ["latin-ext"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
  display: "swap"
});
const inter = Inter({ subsets: ["latin-ext"], variable: "--font-inter", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500"],
  display: "swap"
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "Bankmiplaci";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${siteName} — porównywarka promocji bankowych`, template: `%s — ${siteName}` },
  description:
    "Porównujemy aktualne promocje bankowe w Polsce: ile możesz otrzymać, co musisz zrobić i czy warto skorzystać.",
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName,
    url: siteUrl
  },
  robots: { index: true, follow: true }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="pl" className={`${fraunces.variable} ${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <script
          // Blocking, runs before paint — reads the saved theme (or OS preference)
          // and sets the `dark` class before hydration so there's no flash of
          // the wrong theme. Kept inline (not an external file) so it can't be
          // delayed by script loading/caching.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`
          }}
        />
        <AuthModalProvider>
          <Header user={user} />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthModalProvider>
      </body>
    </html>
  );
}
