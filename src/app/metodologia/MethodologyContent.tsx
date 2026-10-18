import Link from "next/link";
import { ACCOUNT_TYPE_LABEL, formatDatePL, formatPLN, pluralizePl } from "@/lib/format";
import { LATEST_VERIFICATION_LABEL, RATING_NOTE } from "@/lib/disclosureCopy";
import { AGING_MAX_DAYS, FRESH_MAX_DAYS, STALE_SUFFIX } from "@/lib/freshness";
import { Callout, TextPage, type TocEntry } from "../jak-to-dziala/TextPage";
import type { MethodologyData, RatingExample } from "./loadMethodologyData";
import {
  DIFFICULTY_LABEL_PL,
  DIFFICULTY_SCORE,
  MIN_PEERS_OF_TYPE,
  NEUTRAL_SCORE,
  RATING_FLOOR,
  RATING_SPAN,
  RATING_WEIGHTS,
  compositeToRating,
  roundRating,
  type ComponentBreakdown,
  type ComponentKey
} from "./ratingModel";

const num1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num3 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct = (weight: number) => `${Math.round(weight * 100)}%`;

const COMPONENT_ROWS: { key: ComponentKey; name: string; how: string }[] = [
  {
    key: "bonus",
    name: "Wysokość premii",
    how: "Im wyższa premia, tym lepiej: najwyższa w grupie porównywanych ofert dostaje 1, najniższa 0, pozostałe są proporcjonalnie pomiędzy."
  },
  {
    key: "cost",
    name: "Wymagany obrót do premii",
    how: "Szacujemy, ile pieniędzy trzeba przepuścić przez konto lub wydać kartą, żeby zdobyć premię (progi wpływów i płatności z warunków oferty, przemnożone przez liczbę miesięcy, w których trzeba je spełniać), i dzielimy przez wysokość premii. Mniejszy obrót na każdą złotówkę premii znaczy lepiej. To szacunek: gdy z warunków nie da się odczytać progu, składnik dostaje wartość neutralną."
  },
  {
    key: "duration",
    name: "Czas trwania",
    how: "Na ile miesięcy rozłożona jest premia, czyli przez ile miesięcy trzeba spełniać warunki (wynika z harmonogramu w ściądze). Krócej znaczy lepiej."
  },
  {
    key: "difficulty",
    name: "Trudność zdobycia",
    how: `Każda oferta ma jeden z czterech poziomów trudności, który ustalamy m.in. na podstawie wymaganych płatności kartą i progów wpływów na konto: bardzo łatwa ${num2.format(DIFFICULTY_SCORE.VERY_EASY)}, łatwa ${num2.format(DIFFICULTY_SCORE.EASY)}, średnia ${num2.format(DIFFICULTY_SCORE.MEDIUM)}, trudna ${num2.format(DIFFICULTY_SCORE.HARD)}.`
  },
  {
    key: "cooldown",
    name: "Karencja",
    how: `Krócej znaczy lepiej. Regulamin nie zawsze ją podaje; wtedy składnik dostaje wartość neutralną (${num1.format(NEUTRAL_SCORE)}) i nie wpływa na wynik w żadną stronę. Dlatego jego waga jest najniższa.`
  }
];

const SCALE_POINTS = [0, 0.25, 0.5, 0.75, 1];

function accountTypeLabel(type: string): string {
  return (ACCOUNT_TYPE_LABEL as Record<string, string>)[type] ?? type;
}

function describeValue(c: ComponentBreakdown): string {
  const months = (n: number) => `${n} ${pluralizePl(n, "miesiąc", "miesiące", "miesięcy")}`;
  switch (c.key) {
    case "bonus":
      return `Oferta: ${formatPLN(c.value ?? 0)}${c.range ? ` · porównywane: od ${formatPLN(c.range.min)} do ${formatPLN(c.range.max)}` : ""}`;
    case "cost":
      return c.neutral || c.value === null
        ? "Brak odczytanego progu w warunkach – wartość neutralna"
        : `Oferta: ${num1.format(c.value)} zł obrotu na 1 zł premii${c.range ? ` · porównywane: od ${num1.format(c.range.min)} do ${num1.format(c.range.max)}` : ""}`;
    case "duration":
      return c.neutral || c.value === null
        ? "Brak danych o harmonogramie – wartość neutralna"
        : `Oferta: ${months(c.value)}${c.range ? ` · porównywane: od ${c.range.min} do ${c.range.max} mies.` : ""}`;
    case "cooldown":
      return c.neutral || c.value === null
        ? "Brak danych o karencji – wartość neutralna"
        : `Oferta: ${months(c.value)}${c.range ? ` · porównywane: od ${c.range.min} do ${c.range.max} mies.` : ""}`;
    case "difficulty":
      return "";
  }
}

function ExampleBlock({ example }: { example: RatingExample }) {
  const { breakdown } = example;
  const peerCount = `${breakdown.peerCount} ${pluralizePl(breakdown.peerCount, "oferta", "oferty", "ofert")}`;
  const peerGroup = `${peerCount} tego samego typu konta (${accountTypeLabel(example.accountType).toLowerCase()})`;

  return (
    <>
      <p>
        Poniżej ocena jednej z aktualnych ofert, policzona krok po kroku: <Link href={`/promocje/${example.slug}`}>{example.bankName} – {example.name}</Link>. To
        tylko przykład obliczenia, nie rekomendacja ani wyróżnienie oferty. Grupa porównawcza: {peerGroup}.
      </p>
      <div
        role="region"
        tabIndex={0}
        aria-label="Tabela z przykładowym obliczeniem oceny, przewijana poziomo"
        className="mt-4 overflow-x-auto rounded-card"
      >
        <table className="w-full min-w-[30rem] border-collapse text-small leading-6">
          <caption className="sr-only">Obliczenie oceny serwisu dla oferty {example.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-left font-semibold text-ink-900">
                Składnik
              </th>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-right font-semibold text-ink-900">
                Wynik (0–1)
              </th>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-right font-semibold text-ink-900">
                Waga
              </th>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-right font-semibold text-ink-900">
                Wkład
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.components.map((c) => {
              const row = COMPONENT_ROWS.find((r) => r.key === c.key)!;
              const detail =
                c.key === "difficulty"
                  ? `Oferta: ${DIFFICULTY_LABEL_PL[example.difficulty]}`
                  : describeValue(c);
              return (
                <tr key={c.key}>
                  <th scope="row" className="border border-line px-3 py-2 text-left align-top font-normal">
                    <span className="block font-semibold text-ink-900">{row.name}</span>
                    <span className="block text-ink-500">{detail}</span>
                  </th>
                  <td className="num border border-line px-3 py-2 text-right align-top">{num2.format(c.score)}</td>
                  <td className="num border border-line px-3 py-2 text-right align-top">{pct(c.weight)}</td>
                  <td className="num border border-line px-3 py-2 text-right align-top">{num3.format(c.contribution)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="border border-line bg-sunken px-3 py-2 text-left font-semibold text-ink-900">
                Wynik zbiorczy (suma wkładów)
              </th>
              <td className="num border border-line bg-sunken px-3 py-2 text-right font-semibold text-ink-900">
                {num3.format(breakdown.composite)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p>
        Ocena = {num1.format(RATING_FLOOR)} + {num1.format(RATING_SPAN)} × √{num3.format(breakdown.composite)} ={" "}
        {num2.format(breakdown.rawRating)}, po zaokrągleniu do 0,1: <strong>{num1.format(breakdown.rating)}/10</strong>.
        Dokładnie tyle widać przy tej ofercie w serwisie. Wartości w tabeli są zaokrąglone, więc suma wkładów może
        różnić się w ostatnim miejscu.
      </p>
    </>
  );
}

export function MethodologyContent({ data }: { data: MethodologyData }) {
  const { example, ratingStats, latestVerifiedAt } = data;
  const latestVerified = latestVerifiedAt ? formatDatePL(latestVerifiedAt, "short") : "";

  const toc: TocEntry[] = [
    { id: "czym-jest-ocena", label: "Czym jest ocena serwisu" },
    { id: "skladniki", label: "Z czego się składa" },
    { id: "skala", label: "Skala oceny" },
    ...(example ? [{ id: "przyklad", label: "Przykład obliczenia" }] : []),
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
        To liczba od {num1.format(RATING_FLOOR)} do 10 (np. 9,4/10) przy każdej ofercie. Nie jest niezależną ani obiektywną oceną banku,
        jego obsługi czy produktów – dotyczy wyłącznie tego, jak dana promocja wypada na tle innych aktualnych promocji w
        serwisie. Zwykle liczymy ją automatycznie, według opisanych niżej zasad.
      </p>
      <p>
        Oferty porównujemy z innymi aktualnymi ofertami <strong>tego samego typu konta</strong> (np. osobiste i firmowe
        oceniamy osobno i nigdy nie porównujemy ze sobą, bo ich premie nie są porównywalne). Gdy ofert danego typu jest
        mniej niż {MIN_PEERS_OF_TYPE}, składniki porównawcze dostają wartość neutralną. Ocena przelicza się automatycznie, gdy w
        serwisie pojawia się, znika lub zmienia się promocja – dlatego ocena tej samej oferty może się zmienić, choć jej
        warunki zostały takie same.
      </p>
      <p>
        W wyjątkowych przypadkach administrator może ręcznie ustawić ocenę oferty (także spoza tego przedziału),
        jeśli uzna, że wynik liczony automatycznie nie uwzględnia czegoś istotnego. Wtedy przy ofercie może być widoczne krótkie uzasadnienie.
      </p>

      <h2 id="skladniki">Z czego się składa</h2>
      <p>Ocena powstaje z pięciu składników. Każdy dostaje wynik od 0 do 1 i wagę:</p>
      <div
        role="region"
        tabIndex={0}
        aria-label="Tabela składników oceny, przewijana poziomo"
        className="mt-4 overflow-x-auto rounded-card"
      >
        <table className="w-full min-w-[30rem] border-collapse text-small leading-6">
          <caption className="sr-only">Składniki oceny serwisu i ich wagi</caption>
          <thead>
            <tr>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-left font-semibold text-ink-900">
                Składnik
              </th>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-left font-semibold text-ink-900">
                Jak go liczymy
              </th>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-right font-semibold text-ink-900">
                Waga
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPONENT_ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="border border-line px-3 py-2 text-left align-top font-semibold text-ink-900">
                  {row.name}
                </th>
                <td className="border border-line px-3 py-2 align-top">{row.how}</td>
                <td className="num border border-line px-3 py-2 text-right align-top">{pct(RATING_WEIGHTS[row.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Wynik zbiorczy (od 0 do 1) to suma wyników składników pomnożonych przez ich wagi. Przeliczamy go na skalę serwisu
        wzorem: ocena = {num1.format(RATING_FLOOR)} + {num1.format(RATING_SPAN)} × √(wynik zbiorczy), zaokrąglone do
        0,1.
      </p>

      <h2 id="skala">Skala oceny</h2>
      <p>
        Skala nie zaczyna się od zera. Najniższa możliwa ocena liczona automatycznie to {num1.format(RATING_FLOOR)}, a
        najwyższa 10. Pierwiastek w tym wzorze podnosi wyniki środkowe: oferta, która zdobywa połowę możliwych punktów,
        dostaje {num1.format(roundRating(compositeToRating(0.5)))}. Dlatego sama wartość oceny mówi niewiele – liczą się
        różnice między ofertami.
      </p>
      <div
        role="region"
        tabIndex={0}
        aria-label="Tabela przeliczenia wyniku zbiorczego na ocenę, przewijana poziomo"
        className="mt-4 overflow-x-auto rounded-card"
      >
        <table className="w-full min-w-[18rem] border-collapse text-small leading-6">
          <caption className="sr-only">Przeliczenie wyniku zbiorczego na ocenę serwisu</caption>
          <thead>
            <tr>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-left font-semibold text-ink-900">
                Wynik zbiorczy
              </th>
              <th scope="col" className="border border-line bg-sunken px-3 py-2 text-right font-semibold text-ink-900">
                Ocena serwisu
              </th>
            </tr>
          </thead>
          <tbody>
            {SCALE_POINTS.map((point) => (
              <tr key={point}>
                <th scope="row" className="num border border-line px-3 py-2 text-left font-normal">
                  {num2.format(point)}
                </th>
                <td className="num border border-line px-3 py-2 text-right">
                  {num1.format(roundRating(compositeToRating(point)))}/10
                </td>
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

      {example ? (
        <>
          <h2 id="przyklad">Przykład obliczenia</h2>
          <ExampleBlock example={example} />
        </>
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
        <li>
          Opłat za konto i kartę – pokazujemy je przy ofercie osobno, ale nie wchodzą do oceny.
        </li>
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
