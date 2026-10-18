"use client";

import { useEffect } from "react";
import "./globals.css";
import "@/styles/motion.css";
import { buttonClasses } from "@/components/ui/Button";
import { THEME_INIT_SCRIPT } from "@/components/ui/theme";

/**
 * Last-resort boundary: replaces the ROOT layout, so it must bring its own
 * <html>/<body>, its own styles and no components that depend on the layout
 * (no Header, no providers, no next/link - plain <a> reloads the app, which is
 * exactly what we want after a crash). Fonts from layout.tsx are not available
 * here; the Georgia/system-ui fallbacks of the type tokens apply.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <title>Coś poszło nie tak | Bankmiplaci</title>
        <meta name="robots" content="noindex" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <main className="container-page flex-1 py-12 md:py-20">
          <div className="container-reading">
            <p className="type-label text-ink-500">Błąd</p>
            <h1 className="type-h1 mt-2">Coś poszło nie tak</h1>
            <p className="type-lead mt-4 text-ink-700">
              Strona napotkała poważny błąd i nie mogła się wyświetlić. Spróbuj ponownie albo wróć na stronę główną.
            </p>
            {error.digest ? <p className="mt-3 text-caption text-ink-500">Kod błędu: {error.digest}</p> : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={reset} className={buttonClasses({ variant: "primary" })}>
                Spróbuj ponownie
              </button>
              {/* Plain <a> on purpose: a full page load resets the crashed React tree. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className={buttonClasses({ variant: "secondary" })}>
                Strona główna
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
