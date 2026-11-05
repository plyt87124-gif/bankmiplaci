import Link from "next/link";
import { formatDatePL, pluralizePl } from "@/lib/format";
import { LATEST_VERIFICATION_LABEL, RATING_NOTE } from "@/lib/disclosureCopy";
import { AGING_MAX_DAYS, FRESH_MAX_DAYS, STALE_SUFFIX } from "@/lib/freshness";
import { Callout, TextPage, type TocEntry } from "../jak-to-dziala/TextPage";
import type { MethodologyData } from "./loadMethodologyData";
import {
  COMPONENT_KEYS,
  COOLDOWN_ZERO_AT_MONTHS,
  DIFFICULTY_SCORE,
  FEE_BURDEN_ZERO_AT_ZL,
  MIN_PEERS_OF_KIND,
  NEUTRAL_SCORE,
  RATING_CEILING,
  RATING_FLOOR,
  RATING_MEDIAN,
  RATING_WEIGHTS,
  Z_LIMIT,
  curveRating,
  roundRating,
  type ComponentKey
} from "@/lib/ratingModel";

const num1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The components in the order of their weight (the biggest first); the names and weights shown are the model's own. */
const COMPONENT_ROWS: Record<ComponentKey, { name: string; how: string }> = {
  efficiency: {
    name: "Premia w stosunku do własnego obrotu",
    how: "Ile premii dostajesz na każdą złotówkę własnych pieniędzy, które trzeba przepuścić przez konto lub wydać kartą. Liczymy najmniejszy obrót, przy którym spełnisz warunki. Płatności w dowolnej kwocie (np. „3 płatności kartą”) prawie nic nie kosztują, a warunek „wydaj 500 zł” kosztuje 500 zł. Zwrot procentowy wymaga obrotu równego kwota premii ÷ stawka: 2400 zł zwrotu po 20% wydatków to 12 000 zł wydanych pieniędzy, więc taka oferta wypada słabiej, niż sama kwota sugeruje. Skala jest logarytmiczna. To szacunek z opisu warunków."
  },
  netPremium: {
    name: "Wysokość premii",
    how: "Premia, która się liczy, pomniejszona o opłaty, których nie da się uniknąć, na tle mediany ofert tego samego rodzaju. Nie liczymy części premii za zakup produktu: terminala płatniczego, kredytu, pożyczki, leasingu, faktoringu i ubezpieczenia. Zwroty za składki ZUS i podatki liczymy."
  },
  partner: {
    name: "Wynagrodzenie partnerskie serwisu",
    how: "Ile serwis może zarobić na jednym kliencie, który otworzy konto przez nasz link."
  },
  effort: {
    name: "Trudność zdobycia",
    how: `Każda oferta ma jeden z czterech poziomów trudności, który ustalamy m.in. na podstawie wymaganych płatności kartą i progów wpływów na konto: bardzo łatwa ${num2.format(DIFFICULTY_SCORE.VERY_EASY)}, łatwa ${num2.format(DIFFICULTY_SCORE.EASY)}, średnia ${num2.format(DIFFICULTY_SCORE.MEDIUM)}, trudna ${num2.format(DIFFICULTY_SCORE.HARD)}.`
  },
  duration: {
    name: "Czas trwania",
    how: "Na ile miesięcy rozłożona jest premia, czyli przez ile miesięcy trzeba spełniać warunki (wynika z harmonogramu w ściądze). Krócej znaczy lepiej: jeden miesiąc daje 1, rok i więcej daje 0."
  },
  cooldown: {
    name: "Karencja",
    how: `Krócej znaczy lepiej: brak karencji daje 1, ${COOLDOWN_ZERO_AT_MONTHS} miesięcy i więcej daje 0. Liczymy też, jak daleko wstecz bank sprawdza, czy miałeś u niego konto (np. „brak konta od stycznia 2025”). Regulamin nie zawsze podaje karencję; wtedy składnik dostaje wartość neutralną (${num1.format(NEUTRAL_SCORE)}).`
  },
  fees: {
    name: "Opłaty za konto i kartę",
    how: `Suma opłat za prowadzenie konta i kartę w czasie trwania promocji. Opłata, którą można zniżyć do zera po spełnieniu warunku, liczy się za połowę. Brak opłat daje 1, ${FEE_BURDEN_ZERO_AT_ZL} zł i więcej daje 0. Gdy opłat nie zweryfikowaliśmy, składnik dostaje wartość neutralną.`
  }
};

/** Biggest influence first; the sort is stable, so equal weights keep the model's order. */
const ORDERED_KEYS = [...COMPONENT_KEYS].sort((x, y) => RATING_WEIGHTS[y] - RATING_WEIGHTS[x]);

const SCALE_POINTS = [-Z_LIMIT, -1, 0, 1, Z_LIMIT];

function zLabel(z: number): string {
  if (z === 0) return "Dokładnie typowa (mediana)";
  const farther = Math.abs(z) === Z_LIMIT ? " lub bardziej" : "";
  return `${z > 0 ? "Lepsza" : "Słabsza"} o ${Math.abs(z)} ${Math.abs(z) === 1 ? "odchylenie" : "odchylenia"} standardowe${farther}`;
}

export function MethodologyContent({ data }: { data: MethodologyData }) {
  const { ratingStats, latestVerifiedAt } = data;
  const latestVerified = latestVerifiedAt ? formatDatePL(latestVerifiedAt, "short") : "";

  const toc: TocEntry[] = [
    { id: "czym-jest-ocena", label: "Czym jest ocena serwisu" },
    { id: "skladniki", label: "Z czego się składa" },
    { id: "skala", label: "Skala oceny" },
    { id: "zrodla", label: "Skąd bierzemy dane" },
    { id: "czego-nie-uzywamy", label: "Czego nie używamy" },
    { id: "weryfikacja", label: "Co znaczy „Zweryfikowano”" },
    { id: "korekty", label: "Błędy i korekty" }
  ];

  return (
    <TextPage
      path="/metodologia"
      breadcrumbLabel="Metodologia oceny"
      title="Jak liczymy ocenę serwisu"
      lead={
        <p>
          Ocenę serwisu liczymy sami, według jawnych zasad opisanych niżej. Służy do porównania aktualnych promocji.{" "}
          {RATING_NOTE}
        </p>
      }
      toc={toc}
    >
      <h2 id="czym-jest-ocena" className="!mt-0">
        Czym jest ocena serwisu
      </h2>
      <p>
        To liczba przy każdej ofercie (np. 9,4/10). Liczona automatycznie mieści się w przedziale od {num1.format(RATING_FLOOR)} do{" "}
        {num1.format(RATING_CEILING)}. Nie jest niezależną ani obiektywną oceną banku, jego obsługi czy produktów – dotyczy wyłącznie tego,
        jak dana promocja wypada na tle innych aktualnych promocji w serwisie. Zwykle liczymy ją automatycznie, według opisanych niżej
        zasad.
      </p>
      <p>
        Oferty porównujemy z innymi aktualnymi ofertami <strong>tego samego rodzaju</strong>: konta osobiste (także dla młodych,
        oszczędnościowe i wspólne) z osobistymi, konta firmowe z firmowymi. Osobistych z firmowymi nigdy nie porównujemy ze sobą, bo
        ich premie nie są porównywalne. Gdy ofert danego rodzaju jest mniej niż {MIN_PEERS_OF_KIND}, ocena jest środkowa. Ocena
        przelicza się automatycznie, gdy w serwisie pojawia się, znika lub zmienia się promocja albo jej warunki – dlatego ocena tej samej
        oferty może się zmienić, choć jej warunki zostały takie same.
      </p>
      <p>
        W wyjątkowych przypadkach administrator może ręcznie ustawić ocenę oferty (także spoza tego przedziału),
        jeśli uzna, że wynik liczony automatycznie nie uwzględnia czegoś istotnego. Wtedy przy ofercie może być widoczne krótkie uzasadnienie.
      </p>

      <h2 id="skladniki">Z czego się składa</h2>
      <p>
        Ocena powstaje z siedmiu składników. Poniżej są w kolejności od największego do najmniejszego wpływu na ocenę; składniki o równym wpływie
        wymieniamy obok siebie. Dokładnych wag nie podajemy.
      </p>
      <ol>
        {ORDERED_KEYS.map((key) => (
          <li key={key}>
            <strong>{COMPONENT_ROWS[key].name}.</strong> {COMPONENT_ROWS[key].how}
          </li>
        ))}
      </ol>
      <p>
        Każdy składnik dostaje wynik od 0 do 1. Wynik zbiorczy (od 0 do 1) to suma tych wyników, każdy liczony z odpowiednią wagą. Składnik, którego nie da się ustalić, dostaje
        wartość neutralną ({num1.format(NEUTRAL_SCORE)}): nie pomaga i nie szkodzi.
      </p>

      <h2 id="skala">Skala oceny</h2>
      <p>
        Wynik zbiorczy każdej oferty porównujemy z wynikami innych ofert tego samego rodzaju: sprawdzamy, o ile odchyleń standardowych
        odbiega od mediany (liczymy od −{Z_LIMIT} do +{Z_LIMIT}), i przenosimy to na skalę serwisu krzywą wypukłą. Mediana dostaje{" "}
        {num1.format(roundRating(RATING_MEDIAN))}, najsłabsza oferta {num1.format(RATING_FLOOR)}, najlepsza do{" "}
        {num1.format(RATING_CEILING)}. Skala nie zaczyna się od zera, a krzywa powiększa różnice między dobrymi ofertami, więc najlepsze
        wyraźnie odstają. Dlatego sama wartość oceny mówi niewiele – liczą się różnice między ofertami.
      </p>
      <div
        role="region"
        tabIndex={0}
        aria-label="Tabela przeliczenia pozycji oferty na ocenę, przewijana poziomo"
        className="mt-4 overflow-x-auto rounded-card"
      >
        <table className="w-full min-w-[18rem] border-collapse text-small leading-6">
          <caption className="sr-only">Przeliczenie pozycji oferty na tle innych na ocenę serwisu</caption>
          <thead>
            <tr>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-left font-semibold text-ink-900">
                Oferta na tle innych tego rodzaju
              </th>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-right font-semibold text-ink-900">
                Ocena serwisu
              </th>
            </tr>
          </thead>
          <tbody>
            {SCALE_POINTS.map((z) => (
              <tr key={z}>
                <th scope="row" className="border border-line px-3 py-2 text-left font-normal">
                  {zLabel(z)}
                </th>
                <td className="num border border-line px-3 py-2 text-right">{num1.format(roundRating(curveRating(z)))}/10</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ratingStats ? (
        <p>
          Obecnie oceny {ratingStats.count} {pluralizePl(ratingStats.count, "aktualnej oferty", "aktualnych ofert", "aktualnych ofert")} mieszczą się
          w przedziale od {num1.format(ratingStats.min)} do {num1.format(ratingStats.max)}.
        </p>
      ) : null}

      <h2 id="zrodla">Skąd bierzemy dane</h2>
      <ul>
        <li>
          <strong>Regulamin promocji opublikowany przez bank</strong> – kwoty, warunki, terminy i wymagane czynności.
        </li>
        <li>
          <strong>Tabela opłat i prowizji banku</strong> – opłaty za konto i kartę. Gdy opłaty nie zweryfikowaliśmy,
          piszemy „Brak danych”, nigdy „0 zł”.
        </li>
        <li>
          <strong>Nasze ustalenia</strong> – trudność oferty i harmonogram w ściądze przygotowujemy sami na podstawie
          regulaminu.
        </li>
      </ul>
      <p>
        Przy ofercie podajemy link do źródła, gdy go mamy. W razie rozbieżności wiążący jest zawsze regulamin banku.
      </p>

      <h2 id="czego-nie-uzywamy">Czego nie używamy</h2>
      <ul>
        <li>Opinii z for internetowych i mediów społecznościowych.</li>
        <li>Niezweryfikowanych opinii użytkowników, w tym komentarzy pod ofertami.</li>
        <li>Ocen i rankingów innych porównywarek.</li>
        <li>Ogólnej oceny banku (obsługa, aplikacja, wiarygodność) ani Twojej sytuacji, np. tego, czy będziesz nowym klientem.</li>
      </ul>

      <h2 id="weryfikacja">Co znaczy „Zweryfikowano”</h2>
      <p>
        Data przy napisie „Zweryfikowano” to data zapisana przy ofercie, gdy ostatnio porównaliśmy jej warunki ze
        źródłem, czyli z regulaminem banku.{" "}
        {latestVerified
          ? `Najnowsza z tych dat wśród aktualnych ofert to ${latestVerified}; pokazujemy ją jako „${LATEST_VERIFICATION_LABEL}” w stopce i nad listami ofert, ale nie znaczy to, że wszystkie oferty sprawdzono tego dnia – każda ma własną datę. `
          : ""}
        Data nie oznacza, że bank nie zmienił warunków po tym dniu. Nie ogłaszamy stałego harmonogramu weryfikacji.
      </p>
      <p>
        Wygląd znacznika zależy od wieku daty: gdy weryfikacja ma do {FRESH_MAX_DAYS} dni, ikona tarczy jest wyróżniona
        kolorem; od {FRESH_MAX_DAYS + 1} do {AGING_MAX_DAYS} dni jest stonowana; po {AGING_MAX_DAYS} dniach dopisujemy „
        {STALE_SUFFIX}”. Gdy daty nie ma, piszemy „Brak daty weryfikacji”. Oferty, których termin zapisów minął,
        oznaczamy jako zakończone.
      </p>

      <h2 id="korekty">Błędy i korekty</h2>
      <p>
        Jeśli zauważysz błąd w ofercie albo w ocenie, napisz do nas przez{" "}
        <Link href="/kontakt">formularz kontaktowy</Link> lub na adres{" "}
        <a href="mailto:pomoc@bankmiplaci.pl">pomoc@bankmiplaci.pl</a> i podaj adres strony, której dotyczy zgłoszenie.
        Sprawdzamy informację w źródle; jeśli błąd się potwierdzi, poprawiamy ofertę, a gdy nie da się jej rzetelnie
        opisać, oznaczamy ją jako nieaktualną lub usuwamy. Zasady zgłoszeń opisuje też{" "}
        <Link href="/regulamin#reklamacje">regulamin</Link>.
      </p>

      <Callout>
        <p>
          Więcej o tym, jak się utrzymujemy, przeczytasz w{" "}
          <Link href="/jak-zarabiamy">Jak zarabiamy</Link>. O wydawcy serwisu i zasadach redakcyjnych – w{" "}
          <Link href="/o-nas">O nas</Link>.
        </p>
      </Callout>
    </TextPage>
  );
}
