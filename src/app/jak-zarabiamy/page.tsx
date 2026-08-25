import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jak zarabiamy",
  description: "Wyjaśniamy, czym jest marketing afiliacyjny, jak zarabia Bankmiplaci i jak wybieramy promocje.",
  alternates: { canonical: "/jak-zarabiamy" }
};

export default function HowWeEarnPage() {
  return (
    <div className="container-page max-w-2xl py-14">
      <h1 className="text-3xl font-semibold">Jak zarabiamy</h1>
      <p className="mt-4 text-ink-500">
        Bankmiplaci jest darmowe dla użytkowników. Zarabiamy dzięki marketingowi afiliacyjnemu — chcemy, żeby było to
        dla Ciebie w pełni jasne.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-xl font-semibold">Czym jest afiliacja?</h2>
          <p className="mt-2 text-ink-700">
            Gdy przechodzisz do banku przez link oznaczony jako promocyjny na naszej stronie, a następnie otworzysz
            konto i spełnisz warunki promocji, bank może wypłacić nam wynagrodzenie za polecenie. To standardowy
            model finansowania porównywarek finansowych na całym świecie.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Czy wpływa to na Ciebie?</h2>
          <p className="mt-2 text-ink-700">
            Nie. Wysokość premii, warunki promocji i ewentualne opłaty konta są takie same niezależnie od tego, czy
            skorzystasz z naszego linku, czy otworzysz konto bezpośrednio na stronie banku. Nasze wynagrodzenie
            pochodzi od banku, nigdy od Ciebie.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Jak wybieramy promocje?</h2>
          <p className="mt-2 text-ink-700">
            Do bazy trafiają wyłącznie promocje, których warunki zostały zweryfikowane na podstawie oficjalnego
            regulaminu banku. Ocena promocji (np. 9,4/10) jest naszą wewnętrzną, subiektywną oceną uwzględniającą
            wysokość premii, liczbę wymaganych czynności, opłaty i ograniczenia — nie jest to obiektywna ani
            niezależna ocena, a jedynie punkt odniesienia ułatwiający porównanie ofert.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Czy obecność promocji w bazie oznacza rekomendację?</h2>
          <p className="mt-2 text-ink-700">
            Nie. Prezentujemy dostępne promocje wraz z ich warunkami, kosztami i wymaganym wysiłkiem, aby ułatwić Ci
            porównanie ofert. Decyzję o skorzystaniu z danej promocji zawsze podejmujesz samodzielnie, na podstawie
            regulaminu opublikowanego przez bank.
          </p>
        </section>
      </div>
    </div>
  );
}
