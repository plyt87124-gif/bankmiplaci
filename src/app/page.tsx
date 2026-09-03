import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Scale, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { PromotionCard } from "@/components/PromotionCard";
import { EffortMeter } from "@/components/ui/EffortMeter";
import { listActivePromotions, countActivePromotions, getEffortShowcase } from "@/lib/services/promotions";
import { formatPLN, DIFFICULTY_LABEL, DIFFICULTY_EFFORT } from "@/lib/format";
import { AttributionCapture } from "@/components/AttributionCapture";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [personalPromotions, businessPromotions, activeCount, effortShowcase] = await Promise.all([
    listActivePromotions({ sort: "top-rated", accountType: "PERSONAL" }),
    listActivePromotions({ sort: "top-rated", accountType: "BUSINESS" }),
    countActivePromotions(),
    getEffortShowcase()
  ]);
  const hasAnyPromotions = personalPromotions.length > 0 || businessPromotions.length > 0;

  return (
    <>
      <AttributionCapture />
      {/* Hero */}
      <section className="border-b border-ink-100 bg-surface">
        <div className="container-page grid gap-10 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div>
            <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Znajdź najlepsze promocje bankowe
            </h1>
            <p className="mt-5 max-w-md text-lg text-ink-500">
              Porównujemy aktualne promocje bankowe i pokazujemy, ile możesz otrzymać oraz co musisz zrobić, aby
              zdobyć premię.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink href="/promocje" size="lg">
                Zobacz promocje <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/jak-to-dziala" variant="ghost" size="lg">
                Jak to działa?
              </ButtonLink>
            </div>
            {activeCount > 0 && (
              <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink-100 px-4 py-2 text-sm font-medium text-ink-700">
                {/* Genuinely live count (fresh DB read on every request — the
                    whole app renders dynamically because RootLayout reads the
                    session cookie), so — unlike the admin "aktywni
                    użytkownicy" dot (30-day login window, not real presence)
                    — a pulsing dot here is an honest signal. */}
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-600" />
                </span>
                {activeCount} aktualnych promocji w bazie
              </p>
            )}
          </div>

          <div className="self-start rounded-xl2 border border-ink-100 bg-paper p-6 shadow-card">
            <div className="flex items-center gap-2 text-teal-700">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Dopasowanie do Ciebie</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-ink-900">Nie wiesz, którą promocję wybrać?</h2>
            <p className="mt-2 text-sm text-ink-500">
              Odpowiedz na 5 krótkich pytań o to, ile pracy chcesz włożyć i jakie masz możliwości — pokażemy Ci 3
              najlepiej dopasowane promocje z naszej bazy.
            </p>
            <ButtonLink href="/quiz" size="lg" className="mt-5 w-full justify-center">
              Dopasuj promocję do siebie <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Top promotions — personal and business kept in separate rows so
          business promotions (which currently tend to have larger
          absolute bonuses) never crowd personal ones out of a single
          mixed top-N list. */}
      <section className="container-page py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Najlepsze promocje teraz</h2>
          <Link href="/promocje" className="text-sm font-medium text-teal-700 hover:underline">
            Zobacz wszystkie →
          </Link>
        </div>

        {!hasAnyPromotions ? (
          <div className="mt-8 rounded-xl2 border border-dashed border-ink-100 bg-surface p-10 text-center">
            <p className="font-medium text-ink-700">Baza promocji jest obecnie pusta.</p>
            <p className="mt-1 text-sm text-ink-500">
              Dodaj promocje w panelu administracyjnym pod adresem <code>/admin</code>.
            </p>
          </div>
        ) : (
          <>
            {personalPromotions.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Dla osób prywatnych</h3>
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {personalPromotions.slice(0, 3).map((p) => (
                    <PromotionCard key={p.id} promotion={{ ...p, rating: Number(p.rating) }} />
                  ))}
                </div>
              </div>
            )}

            {businessPromotions.length > 0 && (
              <div className="mt-10">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Dla firm</h3>
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {businessPromotions.slice(0, 3).map((p) => (
                    <PromotionCard key={p.id} promotion={{ ...p, rating: Number(p.rating) }} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Effort explainer — signature element. Uses real active promotions
          from the DB (easiest- and hardest-difficulty examples), never a
          made-up amount, so the copy stays true even as the offer changes. */}
      {effortShowcase.length > 0 && (
        <section className="border-y border-ink-100 bg-surface py-16">
          <div className="container-page grid items-center gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold">Ile wysiłku wymaga promocja?</h2>
              <p className="mt-4 max-w-md text-ink-500">
                Wysokość premii nie zawsze znaczy tyle samo. Obok kwoty zawsze pokazujemy, ile realnie trzeba
                zrobić, żeby ją otrzymać — jak w tych aktualnych promocjach z naszej bazy.
              </p>
            </div>
            <div className="space-y-4">
              {effortShowcase.map((item) => (
                <Link
                  key={item.slug}
                  href={`/promocje/${item.slug}`}
                  className="block rounded-xl2 border border-ink-100 bg-paper p-5 transition-shadow hover:shadow-cardHover"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-ink-500">{item.bankName}</p>
                      <span className="font-display text-2xl font-semibold">{formatPLN(item.maxBonusCents)}</span>
                    </div>
                    <span className="text-sm text-ink-500">{DIFFICULTY_LABEL[item.difficulty]}</span>
                  </div>
                  <EffortMeter level={DIFFICULTY_EFFORT[item.difficulty] as 1 | 2 | 3 | 4 | 5} className="mt-3" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trust strip */}
      <section className="container-page grid gap-6 pt-16 pb-20 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl2 border border-ink-100 bg-surface p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-teal-600" />
          <div>
            <p className="font-medium text-ink-900">Weryfikujemy warunki</p>
            <p className="mt-1 text-sm text-ink-500">
              Każda promocja ma widoczną datę ostatniej weryfikacji i termin ważności.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl2 border border-ink-100 bg-surface p-5">
          <Scale className="mt-0.5 h-5 w-5 text-teal-600" />
          <div>
            <p className="font-medium text-ink-900">Pokazujemy koszty i wysiłek</p>
            <p className="mt-1 text-sm text-ink-500">
              Nie tylko wysokość premii — sprawdzisz też opłaty i to, ile realnie trzeba zrobić.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
