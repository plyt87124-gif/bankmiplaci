import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { KARENCJA_DEFINITION } from "@/lib/glossary";
import { staticPageMetadata } from "@/lib/seo";
import { pluralizePl } from "@/lib/format";
import { Callout, TextPage, type TocEntry } from "./TextPage";

export const metadata: Metadata = staticPageMetadata("jakToDziala");

/** The steps of the path from choosing an offer to the bonus; the page counts them, no number is typed by hand. */
const STEP_TITLES = ["Wybierz promocję", "Sprawdź warunki", "Przejdź do banku i załóż konto", "Spełniaj warunki ze ściągą"] as const;

const STEPS_HEADING = `${STEP_TITLES.length} ${pluralizePl(STEP_TITLES.length, "krok", "kroki", "kroków")} od wyboru do premii`;

const TOC: TocEntry[] = [
  { id: "kroki", label: STEPS_HEADING },
  { id: "kto-wyplaca", label: "Kto wypłaca premię" },
  { id: "czego-nie-robimy", label: "Czego Bankmiplaci nie robi" },
  { id: "slowniczek", label: "Słowniczek" }
];

export default function HowItWorksPage() {
  return (
    <TextPage
      path="/jak-to-dziala"
      breadcrumbLabel="Jak to działa"
      title="Jak działają promocje bankowe – krok po kroku"
      lead={
        <p>
          Promocja bankowa to premia lub zwrot od banku za założenie konta i spełnienie warunków z regulaminu.
          Poniżej opisujemy, jak wygląda cała droga – od wyboru oferty do wypłaty – i co w tym robi Bankmiplaci.
        </p>
      }
      toc={TOC}
    >
      <h2 id="kroki">{STEPS_HEADING}</h2>
      <div>
        <section aria-labelledby="krok-1">
          <h3 id="krok-1">1. {STEP_TITLES[0]}</h3>
          <p>
            Przeglądaj <Link href="/promocje">aktualne promocje</Link> albo zestaw je obok siebie na stronie{" "}
            <Link href="/porownaj">porównania</Link>. Jeśli nie wiesz, od czego zacząć, <Link href="/quiz">quiz</Link>{" "}
            zapyta, ile pracy chcesz włożyć i jakie masz możliwości, a potem pokaże promocje z naszego zestawienia, które
            najlepiej pasują do Twoich odpowiedzi.
          </p>
        </section>
        <section aria-labelledby="krok-2">
          <h3 id="krok-2">2. {STEP_TITLES[1]}</h3>
          <p>
            Na stronie oferty znajdziesz kwotę premii, wymagane czynności, opłaty za konto i kartę, termin zapisów, datę
            ostatniej weryfikacji oraz link do regulaminu banku. Gdy jakiejś opłaty nie zweryfikowaliśmy, piszemy „Brak
            danych” – nigdy „0 zł”.
          </p>
          <p>
            Zanim założysz konto, otwórz regulamin promocji na stronie banku. Warunki mogą się zmienić po stronie banku, a
            w razie rozbieżności wiążący jest regulamin banku, nie nasz opis.
          </p>
        </section>
        <section aria-labelledby="krok-3">
          <h3 id="krok-3">3. {STEP_TITLES[2]}</h3>
          <p>
            Przycisk „Przejdź do promocji” prowadzi na stronę banku. To zwykle link partnerski: jeśli założysz konto tą
            drogą i spełnisz warunki, bank lub sieć partnerska może wypłacić nam wynagrodzenie za polecenie. Piszemy o
            tym pod każdym takim przyciskiem, a szczegóły wyjaśniamy na stronie <Link href="/jak-zarabiamy">Jak zarabiamy</Link>.
            Niektóre promocje są dostępne wyłącznie przez link lub kod – jeśli o tym wiemy, zaznaczamy to w warunkach oferty.
          </p>
          <p>
            Konto zakładasz w banku, na jego stronie lub w aplikacji. Bank poprosi o potwierdzenie tożsamości (KYC, patrz
            słowniczek niżej) i to on decyduje, czy otworzy Ci konto.
          </p>
        </section>
        <section aria-labelledby="krok-4">
          <h3 id="krok-4">4. {STEP_TITLES[3]}</h3>
          <p>
            Promocje z wieloma etapami (np. kilka płatności kartą w drugim miesiącu) możesz dodać do ściągi w{" "}
            <Link href="/konto">Moim koncie</Link>. Zaznaczasz kroki, gdy je wykonasz, miesiąc po miesiącu. Gdy zbliża
            się termin kroków z danego miesiąca, a nie wszystkie zaznaczono, serwis może wysłać e-mail z przypomnieniem –
            nie gwarantujemy jednak jego wysyłki, więc pilnuj terminów także samodzielnie. Ściąga wymaga konta w
            serwisie. Zaznaczenia w ściądze nie są przekazywane bankom.
          </p>
        </section>
      </div>

      <h2 id="kto-wyplaca">Kto wypłaca premię</h2>
      <p>
        Premię wypłaca bank – według własnego regulaminu i w terminie, który ten regulamin podaje. Nie mamy wglądu w Twoje
        konto ani w to, czy bank uznał warunki za spełnione. Jeśli premia nie dotarła, zacznij od kontaktu z bankiem; w
        sprawie błędu w naszym opisie oferty napisz do nas przez <Link href="/kontakt">formularz kontaktowy</Link>.
      </p>

      <h2 id="czego-nie-robimy">Czego Bankmiplaci nie robi</h2>
      <ul>
        <li>Nie jest bankiem ani doradcą finansowym, podatkowym czy prawnym.</li>
        <li>Nie zakłada kont w Twoim imieniu i nie jest stroną umowy z bankiem.</li>
        <li>Nie decyduje o przyznaniu premii ani nie gwarantuje jej wypłaty.</li>
        <li>
          Nie porównuje całego rynku – pokazuje promocje, które przeanalizowaliśmy. Brak banku w serwisie nie oznacza, że
          nie ma tam dobrej oferty.
        </li>
      </ul>

      <h2 id="slowniczek">Słowniczek</h2>
      <dl>
        <dt>Karencja</dt>
        <dd>
          {KARENCJA_DEFINITION} Gdy ją znamy, serwis może na podstawie podanej przez Ciebie daty zamknięcia konta
          pokazać, od kiedy możesz skorzystać z oferty.
        </dd>
        <dt>Nowy klient</dt>
        <dd>
          Osoba, która według regulaminu promocji kwalifikuje się jako nowa w banku – zwykle chodzi o brak konta (albo
          konta danego typu) w banku przez określony czas przed złożeniem wniosku. Definicję zawsze ustala bank.
        </dd>
        <dt>KYC (weryfikacja tożsamości)</dt>
        <dd>
          Procedura, w której bank potwierdza, kim jesteś, zanim otworzy konto – np. na podstawie dokumentu
          tożsamości, przelewu weryfikacyjnego albo rozmowy wideo. Sposób zależy od banku.
        </dd>
        <dt>Ocena serwisu</dt>
        <dd>
          Nasz wewnętrzny wskaźnik do szybkiego porównania aktualnych ofert, liczony bez uwzględnienia prowizji.
          Wyjaśniamy go w <Link href="/metodologia">metodologii</Link>.
        </dd>
        <dt>Link partnerski</dt>
        <dd>
          Link do strony banku, za który możemy otrzymać wynagrodzenie, jeśli otworzysz konto i spełnisz warunki.
          Zawsze jest oznaczony – zob. <Link href="/jak-zarabiamy">Jak zarabiamy</Link>.
        </dd>
      </dl>

      <Callout>
        <p>
          Opisy w serwisie mają charakter informacyjny i nie są doradztwem. Ostateczne warunki zawsze określa regulamin
          banku.
        </p>
      </Callout>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/promocje">Zobacz aktualne promocje</ButtonLink>
        <ButtonLink href="/quiz" variant="secondary">
          Dopasuj w quizie
        </ButtonLink>
      </div>
    </TextPage>
  );
}
