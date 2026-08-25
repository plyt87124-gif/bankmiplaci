import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Regulamin", alternates: { canonical: "/regulamin" } };

export default function Regulamin() {
  return (
    <LegalPage title="Regulamin serwisu">
      <p>Data wejścia w życie: 31.08.2026</p>

      <h2>1. Postanowienia ogólne</h2>
      <ol>
        <li>Niniejszy Regulamin określa zasady korzystania z serwisu internetowego Bankmiplaci, dostępnego pod adresem bankmiplaci.pl, zwanego dalej „Serwisem”.</li>
        <li>
          Operatorem Serwisu jest:
          <br />
          Michał Kamiński
          <br />
          JDG
          <br />
          Stawiszyn 7a, 26-800 Białobrzegi
          <br />
          NIP: 7981482892
          <br />
          REGON: 388504613
          <br />
          E-mail: <a href="mailto:pomoc@bankmiplaci.pl">pomoc@bankmiplaci.pl</a>
          <br />
          dalej zwany „Operatorem”.
        </li>
        <li>
          Kontakt z Operatorem jest możliwy za pośrednictwem adresu e-mail:{" "}
          <a href="mailto:pomoc@bankmiplaci.pl">pomoc@bankmiplaci.pl</a> lub formularza kontaktowego dostępnego w
          Serwisie, jeżeli taki formularz został udostępniony.
        </li>
        <li>Regulamin jest udostępniany nieodpłatnie w Serwisie w sposób umożliwiający jego odtworzenie i zapisanie.</li>
        <li>Korzystanie z Serwisu oznacza akceptację niniejszego Regulaminu w zakresie, w jakim przepisy prawa pozwalają na takie jego stosowanie.</li>
      </ol>

      <h2>2. Charakter Serwisu</h2>
      <ol>
        <li>
          Serwis jest internetową porównywarką i platformą informacyjną prezentującą informacje dotyczące w
          szczególności:
          <ul>
            <li>kont bankowych,</li>
            <li>promocji bankowych,</li>
            <li>bonusów i premii związanych z produktami bankowymi,</li>
            <li>warunków uczestnictwa w promocjach,</li>
            <li>opłat związanych z wybranymi produktami,</li>
            <li>innych produktów lub usług finansowych, jeżeli zostaną dodane do Serwisu.</li>
          </ul>
        </li>
        <li>
          Serwis może wykorzystywać model marketingu afiliacyjnego. Oznacza to, że Operator może otrzymywać
          wynagrodzenie lub inną formę prowizji od partnera za przekierowanie użytkownika do jego strony lub za
          wykonanie przez użytkownika określonego działania.
        </li>
        <li>
          Fakt korzystania z linku partnerskiego nie powoduje zwiększenia ceny produktu lub usługi dla
          użytkownika, chyba że z informacji dotyczących konkretnej oferty wynika inaczej.
        </li>
        <li>
          Operator nie jest bankiem, instytucją kredytową, zakładem ubezpieczeń, firmą inwestycyjną ani inną
          instytucją finansową, chyba że wyraźnie wskazano inaczej.
        </li>
        <li>Operator nie zawiera w imieniu użytkownika umów z bankami ani innymi podmiotami prezentowanymi w Serwisie.</li>
        <li>Operator nie jest stroną umów zawieranych pomiędzy użytkownikiem a bankiem lub innym dostawcą produktu lub usługi.</li>
        <li>Umowa dotycząca produktu lub usługi jest zawierana bezpośrednio pomiędzy użytkownikiem a właściwym bankiem lub innym dostawcą.</li>
        <li>
          Operator nie ma wpływu na ostateczną decyzję banku dotyczącą otwarcia rachunku, przyznania produktu,
          wypłaty premii lub spełnienia przez użytkownika warunków promocji.
        </li>
        <li>
          Informacje prezentowane w Serwisie mają charakter informacyjny i porównawczy. Nie stanowią oferty w
          rozumieniu przepisów prawa, rekomendacji inwestycyjnej, porady finansowej, podatkowej ani prawnej.
        </li>
        <li>
          W przypadku rozbieżności pomiędzy informacjami przedstawionymi w Serwisie a regulaminem lub innymi
          oficjalnymi dokumentami banku, wiążące dla użytkownika są dokumenty właściwego banku lub dostawcy
          produktu.
        </li>
      </ol>

      <h2>3. Zasady korzystania z Serwisu</h2>
      <ol>
        <li>Użytkownik może korzystać z Serwisu w sposób zgodny z obowiązującym prawem, niniejszym Regulaminem oraz dobrymi obyczajami.</li>
        <li>Korzystanie z podstawowych funkcji Serwisu jest co do zasady bezpłatne, chyba że przy konkretnej funkcji wyraźnie wskazano inaczej.</li>
        <li>
          Użytkownik zobowiązuje się w szczególności do:
          <ul>
            <li>niepodejmowania działań mogących zakłócić prawidłowe funkcjonowanie Serwisu,</li>
            <li>niepodejmowania prób uzyskania nieuprawnionego dostępu do systemów Operatora,</li>
            <li>niepodejmowania działań mających na celu obejście zabezpieczeń Serwisu,</li>
            <li>nieumieszczania w Serwisie treści bezprawnych, jeżeli Serwis umożliwia ich publikowanie,</li>
            <li>korzystania z treści Serwisu zgodnie z prawem.</li>
          </ul>
        </li>
        <li>Zabronione jest wykorzystywanie Serwisu do działań naruszających prawa Operatora, partnerów, banków lub osób trzecich.</li>
        <li>Użytkownik może korzystać z informacji dostępnych w Serwisie na własny użytek, z zastrzeżeniem przepisów dotyczących praw autorskich i innych praw własności intelektualnej.</li>
        <li>
          Kopiowanie, rozpowszechnianie lub wykorzystywanie większych części Serwisu, w szczególności w celu
          stworzenia konkurencyjnej bazy danych lub serwisu, wymaga odpowiedniej podstawy prawnej lub zgody
          uprawnionego podmiotu.
        </li>
        <li>Linki prowadzące do stron banków i innych partnerów mogą być linkami partnerskimi.</li>
        <li>Operator może zmieniać strukturę Serwisu, jego funkcjonalności, sposób prezentowania ofert oraz zakres dostępnych treści.</li>
      </ol>

      <h2>4. Odpowiedzialność</h2>
      <ol>
        <li>Operator dokłada należytej staranności, aby informacje prezentowane w Serwisie były aktualne, rzetelne i możliwie kompletne.</li>
        <li>
          Promocje bankowe mogą jednak ulegać zmianom, w szczególności w zakresie:
          <ul>
            <li>wysokości premii,</li>
            <li>terminów obowiązywania,</li>
            <li>warunków uczestnictwa,</li>
            <li>dostępności promocji,</li>
            <li>opłat,</li>
            <li>kryteriów kwalifikacji użytkownika.</li>
          </ul>
        </li>
        <li>Operator nie gwarantuje, że informacje prezentowane w Serwisie będą w każdym momencie kompletne, aktualne lub wolne od błędów.</li>
        <li>Przed skorzystaniem z promocji użytkownik powinien zapoznać się z aktualnym regulaminem promocji, tabelą opłat i prowizji oraz innymi dokumentami udostępnionymi przez bank.</li>
        <li>Oficjalne dokumenty banku stanowią wiążące źródło informacji dotyczących warunków produktu lub promocji.</li>
        <li>
          Operator nie odpowiada za:
          <ul>
            <li>decyzję banku o odmowie otwarcia rachunku lub udostępnienia produktu,</li>
            <li>decyzję banku o przyznaniu lub nieprzyznaniu premii,</li>
            <li>niespełnienie przez użytkownika warunków promocji,</li>
            <li>zmiany regulaminów banków,</li>
            <li>działanie stron internetowych banków,</li>
            <li>przerwy techniczne po stronie banków lub innych partnerów,</li>
            <li>treść dokumentów i regulaminów publikowanych przez banki,</li>
            <li>skutki podjęcia przez użytkownika decyzji na podstawie informacji prezentowanych w Serwisie, w zakresie dopuszczalnym przez obowiązujące przepisy prawa.</li>
          </ul>
        </li>
        <li>W przypadku gdy informacja dotycząca promocji okaże się nieaktualna, Operator może ją poprawić, zaktualizować, oznaczyć jako nieaktualną lub usunąć.</li>
        <li>Żadne postanowienie Regulaminu nie wyłącza ani nie ogranicza odpowiedzialności Operatora w zakresie, w którym takie wyłączenie lub ograniczenie jest niedopuszczalne na podstawie obowiązujących przepisów prawa.</li>
      </ol>

      <h2>5. Reklamacje i zgłaszanie nieprawidłowości</h2>
      <ol>
        <li>Użytkownik może zgłosić Operatorowi nieprawidłowość dotyczącą funkcjonowania Serwisu lub prezentowanych w nim informacji.</li>
        <li>
          W szczególności zgłoszenie może dotyczyć:
          <ul>
            <li>nieaktualnej promocji,</li>
            <li>błędnej informacji o warunkach promocji,</li>
            <li>nieprawidłowego działania linku,</li>
            <li>błędnego działania funkcji Serwisu,</li>
            <li>innych zauważonych nieprawidłowości.</li>
          </ul>
        </li>
        <li>
          Zgłoszenie należy przesłać na adres: <a href="mailto:pomoc@bankmiplaci.pl">pomoc@bankmiplaci.pl</a>
        </li>
        <li>
          W zgłoszeniu zaleca się podanie:
          <ul>
            <li>imienia lub pseudonimu,</li>
            <li>adresu e-mail, jeżeli odpowiedź ma zostać udzielona drogą elektroniczną,</li>
            <li>opisu problemu,</li>
            <li>adresu URL strony, której dotyczy zgłoszenie,</li>
            <li>innych informacji pozwalających na identyfikację problemu.</li>
          </ul>
        </li>
        <li>Operator rozpatruje zgłoszenia w rozsądnym terminie, z uwzględnieniem charakteru zgłoszenia i obowiązujących przepisów prawa.</li>
        <li>Jeżeli zgłoszenie dotyczy warunków promocji lub decyzji banku, Operator może wskazać użytkownikowi konieczność skontaktowania się bezpośrednio z właściwym bankiem.</li>
        <li>Zgłoszenie nie powinno zawierać danych logowania, numerów kart, haseł ani innych poufnych danych finansowych.</li>
      </ol>

      <h2>6. Postanowienia końcowe</h2>
      <ol>
        <li>Regulamin obowiązuje od dnia 31.08.2026.</li>
        <li>
          Operator może zmienić Regulamin z ważnych przyczyn, w szczególności w przypadku:
          <ul>
            <li>zmiany przepisów prawa,</li>
            <li>zmiany funkcjonalności Serwisu,</li>
            <li>zmiany sposobu prowadzenia Serwisu,</li>
            <li>konieczności doprecyzowania postanowień Regulaminu,</li>
            <li>zmian dotyczących zakresu usług świadczonych za pośrednictwem Serwisu.</li>
          </ul>
        </li>
        <li>Aktualna wersja Regulaminu jest zawsze dostępna w Serwisie.</li>
        <li>O istotnych zmianach Regulaminu Operator może poinformować poprzez odpowiedni komunikat w Serwisie lub w inny odpowiedni sposób.</li>
        <li>Do korzystania z Serwisu stosuje się prawo polskie, z zastrzeżeniem bezwzględnie obowiązujących przepisów prawa chroniących konsumentów.</li>
        <li>W przypadku sporów z użytkownikiem będącym konsumentem właściwość sądu ustalana jest zgodnie z obowiązującymi przepisami prawa.</li>
        <li>W przypadku użytkowników niebędących konsumentami, o ile przepisy prawa na to pozwalają, spory mogą być rozstrzygane przez sąd właściwy dla siedziby Operatora.</li>
        <li>Jeżeli którekolwiek postanowienie Regulaminu okaże się nieważne lub nieskuteczne, pozostałe postanowienia pozostają w mocy w zakresie dopuszczalnym przez prawo.</li>
        <li>Regulamin dostępny jest nieodpłatnie pod adresem bankmiplaci.pl/regulamin.</li>
      </ol>
    </LegalPage>
  );
}
