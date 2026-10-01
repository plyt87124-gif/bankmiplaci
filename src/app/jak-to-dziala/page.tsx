import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jak to działa",
  description: "Jak znaleźć, zweryfikować i skorzystać z promocji bankowej na Bankmiplaci — krok po kroku.",
  alternates: { canonical: "/jak-to-dziala" }
};

export default function HowItWorksPage() {
  return (
    <div className="container-page max-w-2xl py-14">
      <h1 className="text-3xl font-semibold">Jak to działa</h1>
      <p className="mt-4 text-ink-500">
        Cztery kroki od wyboru promocji do odebrania premii. Każdy z nich opisujemy poniżej tak, jak faktycznie
        działa serwis — bez pominięć.
      </p>

      <ol className="mt-10 space-y-8">
        <li>
          <h2 className="text-xl font-semibold">1. Wybierz promocję</h2>
          <p className="mt-2 text-ink-700">
            Przeglądaj{" "}
            <Link href="/promocje" className="text-teal-700 underline">
              wszystkie aktualne promocje
            </Link>{" "}
            albo porównaj je obok siebie na stronie{" "}
            <Link href="/porownaj" className="text-teal-700 underline">
              porównania kont
            </Link>
            . Jeśli nie wiesz, od czego zacząć,{" "}
            <Link href="/quiz" className="text-teal-700 underline">
              krótki quiz
            </Link>{" "}
            dopasuje 3 promocje do tego, ile pracy chcesz włożyć i jakie masz możliwości.
          </p>
        </li>

        <li>
          <h2 className="text-xl font-semibold">2. Sprawdź warunki</h2>
          <p className="mt-2 text-ink-700">
            Na stronie każdej promocji znajdziesz premię, wymagane czynności, opłaty za konto i kartę oraz datę
            ostatniej weryfikacji i link do regulaminu banku. Zanim otworzysz konto, zawsze warto zweryfikować
            aktualny regulamin na stronie banku — warunki mogą się zmienić po jego stronie.
          </p>
        </li>

        <li>
          <h2 className="text-xl font-semibold">3. Przejdź do banku</h2>
          <p className="mt-2 text-ink-700">
            Przycisk „Przejdź do promocji” prowadzi na stronę banku. Jeśli otworzysz konto i spełnisz warunki
            promocji, bank może wypłacić nam wynagrodzenie za polecenie — to nie wpływa na Twoją ofertę ani nie
            kosztuje Cię nic dodatkowego. Szczegóły wyjaśniamy na stronie{" "}
            <Link href="/jak-zarabiamy" className="text-teal-700 underline">
              „Jak zarabiamy”
            </Link>
            .
          </p>
        </li>

        <li>
          <h2 className="text-xl font-semibold">4. Korzystaj ze ściągi</h2>
          <p className="mt-2 text-ink-700">
            Dla promocji z wieloma etapami (np. „zrób 3 płatności kartą w drugim miesiącu”) możesz dołączyć do
            interaktywnej ściągi w{" "}
            <Link href="/konto" className="text-teal-700 underline">
              Moim koncie
            </Link>
            . Odhaczasz zrobione kroki miesiąc po miesiącu, a serwis przypomni Ci, gdy zbliża się termin.
          </p>
        </li>
      </ol>
    </div>
  );
}
