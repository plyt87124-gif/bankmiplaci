import Link from "next/link";
import { ArrowRight, ShieldCheck, Scale, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { PromotionCard } from "@/components/PromotionCard";
import { listActivePromotions, countActivePromotions } from "@/lib/services/promotions";
import { PageViewTracker } from "@/components/PageViewTracker";

export default async function HomePage() {
  const [topPromotions, activeCount] = await Promise.all([
    listActivePromotions({ sort: "top-rated" }),
    countActivePromotions()
  ]);

  return (
    <>
      <PageViewTracker />
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
                <span className="h-2 w-2 rounded-full bg-teal-600" />
                {activeCount} aktualnych promocji w bazie
              </p>
            )}
          </div>

          <form action="/promocje" className="self-start rounded-xl2 border border-ink-100 bg-paper p-6 shadow-card">
            <label htmlFor="q" className="text-sm font-medium text-ink-700">
              Czego szukasz?
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-full border border-ink-100 bg-surface px-4 py-2.5">
              <Search className="h-4 w-4 text-ink-300" />
              <input
                id="q"
                name="q"
                placeholder="np. konto z premią, promocje PKO, bez wpływu"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-300"
              />
            </div>
            <button className="mt-4 w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700">
              Szukaj
            </button>
            <p className="mt-3 text-xs text-ink-500">
              Wyszukiwanie działa wyłącznie na promocjach znajdujących się w naszej bazie.
            </p>
          </form>
        </div>
      </section>

      {/* Top promotions */}
      <section className="container-page py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Najlepsze promocje teraz</h2>
          <Link href="/promocje" className="text-sm font-medium text-teal-700 hover:underline">
            Zobacz wszystkie →
          </Link>
        </div>

        {topPromotions.length === 0 ? (
          <div className="mt-8 rounded-xl2 border border-dashed border-ink-100 bg-surface p-10 text-center">
            <p className="font-medium text-ink-700">Baza promocji jest obecnie pusta.</p>
            <p className="mt-1 text-sm text-ink-500">
              Dodaj promocje w panelu administracyjnym pod adresem <code>/admin</code>.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topPromotions.slice(0, 6).map((p) => (
              <PromotionCard key={p.id} promotion={{ ...p, rating: Number(p.rating) }} />
            ))}
          </div>
        )}
      </section>

      {/* Effort explainer — signature element */}
      <section className="border-y border-ink-100 bg-surface py-16">
        <div className="container-page grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Ile wysiłku wymaga promocja?</h2>
            <p className="mt-4 max-w-md text-ink-500">
              700 zł premii nie zawsze znaczy tyle samo. Obok wysokości premii zawsze pokazujemy, ile realnie
              trzeba zrobić, żeby ją otrzymać — żebyś mógł porównać „700 zł / łatwa” z „900 zł / trudna” w kilka
              sekund.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl2 border border-ink-100 bg-paper p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-2xl font-semibold">700 zł</span>
                <span className="text-sm text-ink-500">Łatwa</span>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-ink-100">
                <div className="h-full w-2/5 rounded-full bg-teal-600" />
              </div>
            </div>
            <div className="rounded-xl2 border border-ink-100 bg-paper p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-2xl font-semibold">900 zł</span>
                <span className="text-sm text-ink-500">Trudna</span>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-ink-100">
                <div className="h-full w-5/5 rounded-full bg-coral-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quiz teaser */}
      <section className="container-page py-16">
        <div className="rounded-xl2 border border-ink-100 bg-ink-solid p-10 text-center text-white md:p-14">
          <h2 className="text-2xl font-semibold">Nie wiesz, którą promocję wybrać?</h2>
          <p className="mx-auto mt-3 max-w-md text-white/70">
            Odpowiedz na kilka pytań o to, ile pracy chcesz włożyć i jakie masz możliwości — pokażemy Ci 3
            najlepiej dopasowane promocje.
          </p>
          <ButtonLink href="/quiz" variant="secondary" size="lg" className="mt-6">
            Dopasuj promocję do siebie <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </section>

      {/* Trust strip */}
      <section className="container-page grid gap-6 pb-20 sm:grid-cols-2">
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
              Nie tylko wysokość premii — sprawdzisz też opłaty i to, ile realnie trzeba zrobić.{" "}
              <Link href="/jak-zarabiamy" className="underline">
                Jak zarabiamy
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
