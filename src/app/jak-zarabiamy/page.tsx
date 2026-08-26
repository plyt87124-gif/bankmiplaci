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
            regulaminu banku. Każda ma widoczną datę ostatniej weryfikacji i link do źródła.
          </p>
        </section>

        <section id="ocena">
          <h2 className="text-xl font-semibold">Jak liczymy ocenę promocji?</h2>
          <p className="mt-2 text-ink-700">
            Ocena (np. 9,4/10) to nasz <strong>wewnętrzny, subiektywny wskaźnik</strong> do szybkiego porównania
            ofert — nie jest to niezależna ani obiektywna ocena banku ani jego produktów. Liczymy ją automatycznie
            zawsze w porównaniu do innych aktualnie aktywnych promocji tego samego typu konta (konto osobiste
            i firmowe oceniamy osobno — 5000 zł premii firmowej i 900 zł premii osobistej to nieporównywalne kwoty),
            biorąc pod uwagę pięć rzeczy:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-700">
            <li><strong>Wysokość premii</strong> — im więcej, tym lepiej (waga ok. 30%).</li>
            <li>
              <strong>Trudność zdobycia</strong> — ile płatności kartą, jakie warunki, jaki próg zasilenia konta
              trzeba zapewnić (waga ok. 30%).
            </li>
            <li>
              <strong>Czas trwania promocji</strong> — przez ile miesięcy trzeba pozostać aktywnym, żeby dostać
              całą premię; krócej znaczy lepiej (waga ok. 20%).
            </li>
            <li>
              <strong>Średnia premia na miesiąc</strong> — nie tylko łączna kwota, ale ile realnie wychodzi na
              miesiąc włożonego wysiłku (waga ok. 15%).
            </li>
            <li>
              <strong>Okres karencji</strong> — jak długo trzeba czekać, zanim znów można skorzystać z promocji
              tego banku; krócej znaczy lepiej. Ta informacja nie zawsze jest znana z regulaminu, więc dla części
              promocji nie wpływa na wynik (waga ok. 5%).
            </li>
          </ul>
          <p className="mt-3 text-ink-700">
            Ocena przelicza się automatycznie za każdym razem, gdy w bazie pojawia się, znika lub zmienia się
            jakaś promocja — więc zawsze odzwierciedla aktualną konkurencję między ofertami, a nie dane sprzed
            tygodni. W rzadkich przypadkach administrator może ręcznie nadpisać wynik, jeśli uzna, że algorytm nie
            uwzględnił czegoś istotnego — powód takiej oceny zawsze znajdziesz w krótkim uzasadnieniu widocznym
            przy każdej promocji.
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
