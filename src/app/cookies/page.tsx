import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Polityka cookies", alternates: { canonical: "/cookies" } };

export default function Cookies() {
  return (
    <LegalPage title="Polityka cookies">
      <p>Data obowiązywania: 31.08.2026</p>
      <p>Niniejsza Polityka cookies określa zasady wykorzystywania plików cookies oraz podobnych technologii w serwisie internetowym Bankmiplaci, dostępnym pod adresem bankmiplaci.pl.</p>
      <p>
        Administratorem Serwisu jest:
        <br />
        Michał Kamiński
        <br />
        Jednoosobowa działalność gospodarcza (JDG)
        <br />
        Stawiszyn 7a, 26-800 Białobrzegi
        <br />
        NIP: 7981482892
        <br />
        REGON: 388504613
        <br />
        E-mail: <a href="mailto:pomoc@bankmiplaci.pl">pomoc@bankmiplaci.pl</a>
      </p>

      <h2>1. Czym są pliki cookies?</h2>
      <p>Cookies to niewielkie pliki tekstowe zapisywane na urządzeniu użytkownika podczas korzystania ze strony internetowej.</p>
      <p>Mogą służyć między innymi do zapewnienia prawidłowego działania strony, zapamiętywania ustawień, zapewnienia bezpieczeństwa oraz prowadzenia statystyk.</p>

      <h2>2. Cookies niezbędne</h2>
      <p>Serwis wykorzystuje cookies niezbędne do prawidłowego działania jego podstawowych funkcji. Aktualnie są to wyłącznie dwa własne (first-party) cookies sesyjne uwierzytelniania — szczegóły w tabeli w sekcji 6. Mogą one służyć między innymi do:</p>
      <ul>
        <li>zapewnienia prawidłowego działania Serwisu,</li>
        <li>utrzymania podstawowej funkcjonalności strony,</li>
        <li>zapamiętania wybranych ustawień,</li>
        <li>zapewnienia bezpieczeństwa,</li>
        <li>obsługi mechanizmu zarządzania zgodami.</li>
      </ul>

      <h2>3. Cookies analityczne</h2>
      <p>
        Serwis obecnie nie wykorzystuje żadnego zewnętrznego narzędzia analitycznego — w kodzie Serwisu nie jest
        zaimplementowana integracja z żadnym takim narzędziem. Statystyki wyświetleń i kliknięć w linki partnerskie
        są liczone wyłącznie po stronie serwera Bankmiplaci, bez zapisywania w tym celu jakiegokolwiek pliku
        cookie ani innego identyfikatora na urządzeniu użytkownika.
      </p>
      <p>Ta sekcja zostanie uzupełniona o nazwę narzędzia, dostawcę, cel, okres przechowywania i zakres przetwarzanych informacji, jeżeli takie narzędzie zostanie w przyszłości wdrożone.</p>

      <h2>4. Cookies afiliacyjne i technologie stosowane przez partnerów</h2>
      <p>
        Serwis nie zapisuje własnych plików cookie w celu śledzenia przekierowań afiliacyjnych — przypisanie
        kliknięcia do promocji odbywa się po stronie serwera Bankmiplaci (zapis w bazie danych, nie w cookie
        użytkownika).
      </p>
      <p>Po kliknięciu w link partnerski użytkownik zostaje przekierowany na stronę banku lub innego partnera. Od tego momentu zastosowanie mają technologie i zasady dotyczące cookies stosowane przez ten podmiot — Bankmiplaci nie ma na nie wpływu.</p>
      <p>Zakres oraz okres działania takich technologii zależą od konkretnego banku, partnera lub systemu afiliacyjnego, do którego użytkownik zostanie przekierowany.</p>

      <h2>5. Zarządzanie zgodą na cookies</h2>
      <p>
        Wszystkie cookies wykorzystywane obecnie przez Serwis (patrz sekcja 6) są cookies niezbędnymi do
        świadczenia usługi, o którą użytkownik aktywnie prosi (utrzymanie zalogowania na koncie użytkownika lub w
        panelu administracyjnym) — ich stosowanie nie wymaga zgody na gruncie obowiązujących przepisów, dlatego
        Serwis nie wyświetla obecnie bannera zgody na cookies.
      </p>
      <p>Jeżeli w przyszłości Serwis wdroży cookies wymagające zgody (np. analityczne), zostanie udostępniony odpowiedni mechanizm zarządzania zgodami, umożliwiający użytkownikowi w szczególności:</p>
      <ul>
        <li>zaakceptowanie określonych kategorii cookies,</li>
        <li>odrzucenie cookies, które nie są niezbędne,</li>
        <li>zmianę wcześniej udzielonej zgody,</li>
        <li>zapoznanie się z informacjami dotyczącymi poszczególnych kategorii technologii.</li>
      </ul>
      <p>Użytkownik może również zarządzać cookies za pomocą ustawień swojej przeglądarki internetowej — w tym usunąć plik cookie premia_session, co spowoduje wylogowanie z konta.</p>
      <p>Wyłączenie cookies niezbędnych (patrz sekcja 6) uniemożliwi korzystanie z funkcji wymagających zalogowania (np. dodawanie komentarzy, zapisywanie dat karencji w „Moje konto”, panel administracyjny).</p>

      <h2>6. Lista wykorzystywanych cookies</h2>
      <p>Poniższa lista odzwierciedla rzeczywistą konfigurację Serwisu na dzień 31.08.2026:</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Dostawca</th>
              <th>Cel</th>
              <th>Rodzaj</th>
              <th>Okres przechowywania</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>premia_session</td>
              <td>Bankmiplaci (własny, first-party)</td>
              <td>Utrzymanie zalogowanej sesji użytkownika konta (np. dostęp do „Moje konto”, dodawanie komentarzy)</td>
              <td>Niezbędne</td>
              <td>30 dni</td>
            </tr>
            <tr>
              <td>next-auth.session-token (na produkcji: __Secure-next-auth.session-token)</td>
              <td>Bankmiplaci (własny, first-party, biblioteka NextAuth.js)</td>
              <td>Utrzymanie zalogowanej sesji administratora w panelu /admin</td>
              <td>Niezbędne</td>
              <td>Sesja / do 30 dni (domyślne ustawienie NextAuth.js)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Lista powinna zostać zaktualizowana w przypadku dodania lub usunięcia wykorzystywanych technologii — w szczególności przy wdrożeniu narzędzia analitycznego lub systemu afiliacyjnego zapisującego własne cookies.</p>

      <h2>7. Zewnętrzne strony internetowe</h2>
      <p>Serwis może zawierać odnośniki do stron internetowych banków oraz innych partnerów.</p>
      <p>Po przejściu na stronę zewnętrzną zasady stosowania cookies i podobnych technologii określa administrator danej strony.</p>
      <p>Administrator Bankmiplaci nie odpowiada za cookies ani inne technologie wykorzystywane przez zewnętrzne strony internetowe.</p>

      <h2>8. Zmiany Polityki cookies</h2>
      <p>Polityka cookies może być aktualizowana w przypadku:</p>
      <ul>
        <li>zmiany wykorzystywanych narzędzi,</li>
        <li>dodania lub usunięcia cookies,</li>
        <li>zmian technologicznych,</li>
        <li>zmian przepisów prawa,</li>
        <li>zmian sposobu funkcjonowania Serwisu.</li>
      </ul>
      <p>Aktualna wersja Polityki cookies jest dostępna w Serwisie.</p>
      <p>Data ostatniej aktualizacji: 31.08.2026</p>
    </LegalPage>
  );
}
