import type { Metadata } from "next";
import Link from "next/link";
import { RATING_COMMISSION_RULE } from "@/lib/disclosureCopy";
import { COMMISSION_WEIGHT } from "@/lib/recommended";
import { staticPageMetadata } from "@/lib/seo";
import { Callout, TextPage, type TocEntry } from "../jak-to-dziala/TextPage";

export const metadata: Metadata = staticPageMetadata("jakZarabiamy");

const TOC: TocEntry[] = [
  { id: "afiliacja", label: "Czym jest afiliacja" },
  { id: "wplyw", label: "Czy to wpływa na Ciebie" },
  { id: "polecane", label: "Co to zmienia w kolejności „Polecane”" },
  { id: "ocena", label: "Jak liczymy ocenę (bez prowizji)" },
  { id: "czego-nie-robimy", label: "Czego nie robimy" },
  { id: "wybor", label: "Jak wybieramy promocje" },
  { id: "rekomendacja", label: "Czy oferta w serwisie to rekomendacja" }
];

const pl2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/**
 * The numbers below are taken from src/lib/recommended.ts, not typed here:
 *   score = (rating / 10) * (1 - W + W * commissionShare)
 * with W = COMMISSION_WEIGHT. commissionShare is 1 for the best-paying offer
 * of an account type, c / max for the others, 0 when the commission is zero
 * and 0.5 (neutral) when it is unknown. tests/content-pages.test.tsx checks
 * these figures against recommendedScores(), so the page cannot drift from
 * the code unnoticed.
 */
const FACTOR_BEST = 1;
const FACTOR_FLOOR = 1 - COMMISSION_WEIGHT;
const FACTOR_UNKNOWN = 1 - COMMISSION_WEIGHT + COMMISSION_WEIGHT * 0.5;

export default function HowWeEarnPage() {
  return (
    <TextPage
      path="/jak-zarabiamy"
      breadcrumbLabel="Jak zarabiamy"
      title="Jak zarabiamy – afiliacja i niezależność oceny"
      lead={
        <>
          <p>Zarabiamy z prowizji od banków za polecenie.</p>
          <p className="mt-3">
            Korzystanie z Bankmiplaci jest bezpłatne dla użytkowników. Poniżej piszemy, jak to działa, co zmienia w tym, co widzisz
            na stronie, a czego nie zmienia.
          </p>
        </>
      }
      toc={TOC}
    >
      <h2 id="afiliacja" className="!mt-0">
        Czym jest afiliacja
      </h2>
      <p>
        Gdy przechodzisz do banku przez link oznaczony jako partnerski (przycisk „Przejdź do promocji”, pod którym
        zawsze piszemy „Link partnerski”), a potem otwierasz konto i spełniasz warunki promocji, bank – bezpośrednio albo
        przez sieć partnerską – może wypłacić nam wynagrodzenie za polecenie. To częsty model finansowania
        porównywarek. Wynagrodzenie nie pochodzi od Ciebie.
      </p>

      <h2 id="wplyw">Czy to wpływa na Ciebie</h2>
      <p>
        Na warunki i koszt promocji – nie: ustala je bank. Co do zasady nie zależą one od tego, czy korzystasz z naszego
        linku. Wyjątkiem są promocje dostępne wyłącznie przez link lub kod; jeśli o tym wiemy, piszemy to w warunkach
        oferty. Ostateczne warunki zawsze określa regulamin banku.
      </p>
      <p>
        Na domyślną kolejność ofert – tak, i to wyraźnie: opisujemy to w następnej sekcji. Ocena serwisu jest natomiast
        liczona bez uwzględniania prowizji.
      </p>

      <h2 id="polecane">Co to zmienia w kolejności „Polecane”</h2>
      <p>
        „Polecane” to domyślna kolejność ofert na stronie głównej i na liście promocji. To nie jest ranking jakości, tylko
        połączenie dwóch rzeczy. Pozycję oferty wyznacza iloczyn dwóch liczb:
      </p>
      <ol>
        <li>
          <strong>Ocena serwisu</strong> (od 0 do 10, liczona bez prowizji – zob. niżej). To punkt wyjścia: gdyby nie
          było drugiego czynnika, kolejność byłaby po prostu kolejnością ocen.
        </li>
        <li>
          <strong>Współczynnik wynagrodzenia partnerskiego</strong> – liczba od {pl2.format(FACTOR_FLOOR)} do{" "}
          {pl2.format(FACTOR_BEST)}, która zależy od tego, ile bank płaci nam za otwarcie konta w porównaniu z innymi
          ofertami tego samego typu konta, które są w tej chwili wyświetlane na liście.
        </li>
      </ol>
      <p>Współczynnik działa tak:</p>
      <ul>
        <li>
          Oferta o najwyższym znanym wynagrodzeniu w swojej grupie dostaje {pl2.format(FACTOR_BEST)} – jej ocena nie jest
          pomniejszana. Grupy to typy kont: konta osobiste porównujemy tylko z osobistymi, firmowe z firmowymi itd.
        </li>
        <li>
          Oferta o niższym wynagrodzeniu dostaje wartość proporcjonalnie niższą, nie mniejszą jednak niż{" "}
          {pl2.format(FACTOR_FLOOR)}.
        </li>
        <li>
          Oferta, dla której nie mamy danych o wynagrodzeniu, dostaje wartość pośrednią – {pl2.format(FACTOR_UNKNOWN)}.
          Brak informacji ani jej nie pomaga, ani nie szkodzi.
        </li>
        <li>Oferta, za którą bank nie płaci nam nic, dostaje najniższą wartość – {pl2.format(FACTOR_FLOOR)}.</li>
      </ul>
      <p>
        Porównanie dotyczy ofert tego samego typu konta, które są aktualnie wyświetlane. Po zastosowaniu filtrów (np.
        wybraniu banku albo poziomu trudności) zestaw porównywanych ofert się zmienia, więc kolejność „Polecane” może
        wyglądać inaczej niż bez filtrów.
      </p>
      <p>Przy takim samym wyniku wyżej jest oferta z wyższą oceną, a potem z wyższą premią.</p>
      <Callout title="To ma realny wpływ na kolejność">
        <p>
          Współczynnik wynagrodzenia zmienia wynik silniej niż różnice między ocenami serwisu. Dlatego oferta o wyraźnie
          niższej ocenie, za którą bank płaci nam więcej, może znaleźć się w „Polecane” wyżej niż oferta o wyraźnie
          wyższej ocenie, za którą płaci mniej albo nic. „Polecane” nie znaczy więc „najlepsze” – to kolejność, w której
          uwzględniamy także to, ile możemy zarobić.
        </p>
      </Callout>
      <p>
        Oferta, na której nie zarabiamy, nadal jest na liście – zmienia się tylko jej miejsce w „Polecane”. Kwot
        wynagrodzenia nie publikujemy.
      </p>
      <h3>Sortowania niezależne od wynagrodzenia</h3>
      <p>
        Jeśli wolisz kolejność, w której wynagrodzenie nie gra roli, wybierz inne sortowanie nad listą ofert. Żadne z nich
        z niego nie korzysta:
      </p>
      <ul>
        <li>
          <strong>Najlepsza ocena</strong> – według oceny serwisu, a przy remisie według wysokości premii,
        </li>
        <li>
          <strong>Najwyższa premia</strong> – według kwoty premii,
        </li>
        <li>
          <strong>Najłatwiejsze</strong> – według trudności, a potem oceny,
        </li>
        <li>
          <strong>Najnowsze</strong> – według daty rozpoczęcia promocji,
        </li>
        <li>
          <strong>Kończące się wkrótce</strong> – według terminu zapisów.
        </li>
      </ul>

      <h2 id="ocena">Jak liczymy ocenę (bez prowizji)</h2>
      <p>
        Ocena serwisu (np. 9,4/10) to nasz wewnętrzny wskaźnik do szybkiego porównania ofert. Nie jest niezależną ani
        obiektywną oceną banku ani jego produktów, a tym bardziej poradą finansową. Liczymy ją automatycznie z pięciu
        składników: wysokości premii, trudności zdobycia, czasu trwania promocji, średniej premii na miesiąc i
        karencji – zawsze na tle innych aktualnych ofert tego samego typu konta.
      </p>
      <p>
        <strong>{RATING_COMMISSION_RULE}</strong> Wagi składników, skalę oceny i – gdy to możliwe – przykład wyliczenia
        na prawdziwej ofercie opisujemy w <Link href="/metodologia">metodologii</Link>.
      </p>

      <h2 id="czego-nie-robimy">Czego nie robimy</h2>
      <ul>
        <li>Nie przyjmujemy płatności za wyższą ocenę serwisu ani za zmianę opisu oferty.</li>
        <li>Nie ukrywamy ofert dlatego, że nie zarabiamy na nich.</li>
        <li>Nie zmieniamy warunków, kwot ani opłat pod wpływem banku – dane pochodzą z regulaminu banku.</li>
        <li>Nie ukrywamy linków partnerskich: oznaczamy je wszędzie tam, gdzie prowadzą do banku.</li>
        <li>Nie pobieramy opłat od użytkowników za korzystanie z porównywarki.</li>
        <li>Nie udajemy banku ani doradcy – nie doradzamy, tylko porównujemy.</li>
      </ul>

      <h2 id="wybor">Jak wybieramy promocje</h2>
      <p>
        Do serwisu trafiają promocje, których warunki sprawdziliśmy w regulaminie banku. Przy ofercie podajemy datę
        ostatniej weryfikacji i, gdy go mamy, link do źródła. Nie porównujemy całego rynku – pokazujemy te promocje,
        które przeanalizowaliśmy.
      </p>

      <h2 id="rekomendacja">Czy oferta w serwisie to rekomendacja</h2>
      <p>
        Nie. Prezentujemy dostępne promocje wraz z warunkami, kosztami i wymaganym wysiłkiem, żeby ułatwić Ci
        porównanie. Decyzję o skorzystaniu z promocji podejmujesz samodzielnie, na podstawie regulaminu banku.
      </p>
    </TextPage>
  );
}
