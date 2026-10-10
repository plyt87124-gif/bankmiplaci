import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { staticPageMetadata } from "@/lib/seo";
import { TextPage, type TocEntry } from "../jak-to-dziala/TextPage";
import { PUBLISHER, publisherAddress } from "@/lib/publisher";

export const metadata: Metadata = staticPageMetadata("oNas");

const TOC: TocEntry[] = [
  { id: "czym-jest-bankmiplaci", label: "Czym jest Bankmiplaci" },
  { id: "wydawca", label: "Kto prowadzi serwis" },
  { id: "weryfikacja", label: "Jak weryfikujemy dane" },
  { id: "finansowanie", label: "Jak się finansujemy" },
  { id: "zasady", label: "Zasady redakcyjne" },
  { id: "korekty", label: "Polityka korekt" },
  { id: "kontakt", label: "Kontakt" }
];

export default function AboutPage() {
  return (
    <TextPage
      path="/o-nas"
      breadcrumbLabel="O nas"
      title="O nas i zasady redakcyjne"
      lead={
        <p>
          Bankmiplaci to polski serwis, który zbiera promocje bankowe na konta osobiste i firmowe i pokazuje ich
          warunki, koszty i terminy w jednym miejscu. Poniżej piszemy, kto go prowadzi i na jakich zasadach powstają
          treści.
        </p>
      }
      toc={TOC}
    >
      <h2 id="czym-jest-bankmiplaci" className="!mt-0">
        Czym jest Bankmiplaci
      </h2>
      <p>
        To internetowa porównywarka i platforma informacyjna. Przy każdej ofercie pokazujemy premię, wymagane czynności,
        opłaty za konto i kartę, termin zapisów oraz datę ostatniej weryfikacji. Dla promocji z wieloma etapami
        udostępniamy ściągę, w której zaznaczasz wykonane kroki. Wyjaśniamy to w{" "}
        <Link href="/jak-to-dziala">Jak to działa</Link>.
      </p>
      <p>
        Bankmiplaci nie jest bankiem i nie zawiera umów z bankami w Twoim imieniu. Konto zakładasz bezpośrednio w
        banku, a o przyznaniu premii decyduje bank.
      </p>

      <h2 id="wydawca">Kto prowadzi serwis</h2>
      <p>Operatorem serwisu, zgodnie z Regulaminem, jest:</p>
      <p>
        {PUBLISHER.name}, {PUBLISHER.legalForm}
        <br />
        {publisherAddress()}
        <br />
        NIP: {PUBLISHER.nip}, REGON: {PUBLISHER.regon}
        <br />
        E-mail: <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a>
      </p>
      <p>
        Pełne zasady korzystania z serwisu opisuje <Link href="/regulamin">Regulamin</Link>, a zasady przetwarzania
        danych – <Link href="/polityka-prywatnosci">Polityka prywatności</Link>.
      </p>

      <h2 id="weryfikacja">Jak weryfikujemy dane</h2>
      <ul>
        <li>Podstawą jest regulamin promocji i tabela opłat banku. Przy ofercie podajemy datę ostatniej weryfikacji i, gdy go mamy, link do źródła.</li>
        <li>Gdy czegoś nie ustaliliśmy (np. opłaty za kartę), piszemy „Brak danych” – nigdy „0 zł”.</li>
        <li>
          Ocenę serwisu liczymy automatycznie według jawnych zasad, bez prowizji. Opisujemy je w{" "}
          <Link href="/metodologia">metodologii</Link>.
        </li>
        <li>Nie obiecujemy stałego harmonogramu weryfikacji, a w razie rozbieżności wiążący jest regulamin banku.</li>
      </ul>

      <h2 id="finansowanie">Jak się finansujemy</h2>
      <p>
        Zarabiamy z prowizji od banków za polecenie: jeśli otworzysz konto przez nasz link partnerski i spełnisz
        warunki, bank lub sieć partnerska może wypłacić nam wynagrodzenie. Korzystanie z serwisu jest dla Ciebie
        bezpłatne. Wynagrodzenie nie wchodzi do oceny serwisu, ale wpływa na domyślną kolejność ofert „Polecane” –
        opisujemy to dokładnie na stronie <Link href="/jak-zarabiamy">Jak zarabiamy</Link>.
      </p>

      <h2 id="zasady">Zasady redakcyjne</h2>
      <ul>
        <li>Opieramy się na dokumentach banków, nie na opiniach z forów i mediów społecznościowych.</li>
        <li>Oznaczamy linki partnerskie wszędzie tam, gdzie prowadzą do banku.</li>
        <li>Nie przyjmujemy płatności za wyższą ocenę serwisu.</li>
        <li>Nie ukrywamy ofert dlatego, że nie zarabiamy na nich.</li>
        <li>Nie porównujemy całego rynku – pokazujemy promocje, które przeanalizowaliśmy.</li>
        <li>Nie doradzamy: opisy mają charakter informacyjny i nie są poradą finansową, podatkową ani prawną.</li>
        <li>Komentarze użytkowników są ich opiniami; nie weryfikujemy ich i nie wpływają na ocenę.</li>
      </ul>

      <h2 id="korekty">Polityka korekt</h2>
      <p>
        Błędy się zdarzają, a promocje zmieniają się szybko. Jeśli zauważysz nieaktualną informację, napisz do nas i
        podaj adres strony, której dotyczy zgłoszenie. Sprawdzamy ją w źródle; jeśli błąd się potwierdzi, poprawiamy
        ofertę, a gdy nie da się jej rzetelnie opisać, oznaczamy ją jako nieaktualną lub usuwamy. Nie wysyłaj nam
        danych logowania, haseł ani numerów kart.
      </p>

      <h2 id="kontakt">Kontakt</h2>
      <p>
        Napisz na <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a> albo użyj formularza.
      </p>
      <div className="mt-4">
        <ButtonLink href="/kontakt" variant="secondary">
          Przejdź do formularza kontaktowego
        </ButtonLink>
      </div>
    </TextPage>
  );
}
