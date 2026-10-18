import type { ReactNode } from "react";

/**
 * Card shared by the standalone account pages (logowanie, rejestracja,
 * reset-hasla): one h1, a short intro, the form. Server-compatible. The page
 * is centred on the page background; the card is a flat hairline panel.
 */
export function AuthCard({
  title,
  intro,
  children
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-[27.5rem] rounded-card border border-line bg-surface p-6 sm:p-8">
        <h1 className="font-display text-h2">{title}</h1>
        {intro ? <p className="mt-2 text-small text-ink-700">{intro}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/** "Nie masz konta? [Załóż konto]" style footer row: a short question and one secondary action. */
export function AuthSwitch({ question, children }: { question: string; children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-3 text-small text-ink-700">{question}</p>
      {children}
    </div>
  );
}
