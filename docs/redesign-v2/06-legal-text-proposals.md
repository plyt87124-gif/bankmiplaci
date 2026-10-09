# 06. Propozycje zmian w tekstach prawnych (do przeglądu prawnika)

Status: PROPOZYCJE. Żadne z poniższych brzmień NIE jest opublikowane na stronie. Strony `/regulamin`, `/polityka-prywatnosci` i `/cookies` zachowały dotychczasową treść prawną (zmieniono wyłącznie układ, typografię i dostępność). Źródło zakresu: `04-trust-and-disclosure-plan.md` §7 oraz pakiet WP-14.

Konwencje:
- `[DO POTWIERDZENIA]` oznacza wartość lub fakt, którego nie da się ustalić z kodu albo który wymaga decyzji właściciela lub prawnika. Nie wolno publikować brzmienia z takim znacznikiem.
- Opisy techniczne poniżej wynikają z kodu repozytorium na dzień 2026-10-09 (modele `PageView`, `Click`, komponent `AttributionCapture`, `theme.ts`). Zmiana kodu wymaga aktualizacji tekstu.
- Numeracja punktów jest robocza; wstawienie nowych rozdziałów przesunie numerację w odsyłaczach wewnętrznych (np. „patrz sekcja 6” w Cookies).

---

## 1. Cookies: dopisanie localStorage i sessionStorage

### 1.1 Stan faktyczny (z kodu)

| Klucz | Miejsce | Cel | Zawartość | Czas |
|---|---|---|---|---|
| `theme` | `localStorage` | zapamiętanie wybranego motywu (jasny, ciemny, systemowy) | jedna z wartości `light`, `dark`, `system` | do usunięcia przez użytkownika (brak wygasania) |
| `bmp_attribution` | `sessionStorage` | zapamiętanie źródła wejścia (parametry `utm_*` i sklasyfikowane źródło ruchu: bezpośrednie, wyszukiwarka, social, domena) do momentu ewentualnego kliknięcia „Przejdź do promocji” | parametry `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (o ile były w adresie), `trafficSource`, znacznik czasu | do zamknięcia karty; dodatkowo odczyt ignoruje wpis starszy niż 24 godziny |

`bmp_attribution` nie jest wysyłany na serwer automatycznie. Jest dołączany do zdarzenia kliknięcia w link „Przejdź do promocji” (zapis w tabeli `Click`).

### 1.2 Proponowane brzmienie: nowa sekcja w „Cookies” (po sekcji 2 lub jako 2a)

> **Pamięć lokalna przeglądarki (localStorage i sessionStorage)**
>
> Oprócz plików cookies Serwis korzysta z pamięci przeglądarki użytkownika (Web Storage). Dane te nie są automatycznie wysyłane do serwera przy każdym żądaniu, jak ma to miejsce w przypadku cookies.
>
> 1. Klucz `theme` (localStorage): zapamiętuje wybrany przez użytkownika motyw wyglądu strony (jasny, ciemny albo zgodny z ustawieniem urządzenia). Ma charakter funkcjonalny i jest zapisywany wyłącznie po wybraniu motywu przez użytkownika. Wpis można usunąć w ustawieniach przeglądarki. [DO POTWIERDZENIA: czy zapis następuje wyłącznie po aktywnym wyborze, czy także przy pierwszym wejściu. Z kodu: zapis przy zmianie preferencji.]
> 2. Klucz `bmp_attribution` (sessionStorage): zapamiętuje, z jakiego źródła użytkownik wszedł do Serwisu (wartości parametrów `utm_*` z adresu strony oraz ogólna kategoria źródła: wejście bezpośrednie, wyszukiwarka, media społecznościowe albo nazwa domeny odsyłającej). Wpis jest usuwany po zamknięciu karty przeglądarki. Jeżeli użytkownik kliknie w link „Przejdź do promocji”, zawartość wpisu jest dołączana do zapisu tego kliknięcia po stronie Serwisu (patrz Polityka prywatności). Wpis nie zawiera danych identyfikujących użytkownika.
>
> [DO POTWIERDZENIA PRZEZ PRAWNIKA: czy zapis `bmp_attribution` stanowi „niezbędny” dostęp do urządzenia (art. 173 Prawa telekomunikacyjnego) i może funkcjonować bez zgody. Plan 04 §7 wskazuje opcję bezpieczną: usunięcie zapisu do sessionStorage i przekazywanie atrybucji wyłącznie w parametrach żądania lub po stronie serwera. Jeżeli prawnik uzna zgodę za wymaganą, bez banera zgody ten mechanizm należy wyłączyć, a opis powyżej nie jest publikowany.]

### 1.3 Proponowane uzupełnienie tabeli w sekcji 6 „Lista wykorzystywanych cookies”

Zmiana tytułu sekcji na „Lista wykorzystywanych cookies i pamięci przeglądarki” oraz dwa nowe wiersze:

| Nazwa | Dostawca | Cel | Rodzaj | Okres przechowywania |
|---|---|---|---|---|
| `theme` (localStorage) | Bankmiplaci (własny) | Zapamiętanie wybranego motywu wyglądu | Funkcjonalny | Do usunięcia przez użytkownika |
| `bmp_attribution` (sessionStorage) | Bankmiplaci (własny) | Zapamiętanie źródła wejścia do powiązania z kliknięciem „Przejdź do promocji” | [DO POTWIERDZENIA: kwalifikacja: niezbędny / funkcjonalny / analityczny] | Do zamknięcia karty (maks. 24 godziny) |

### 1.4 Proponowane zdanie o przyszłych narzędziach (sekcja 5 lub 3)

> Wdrożenie jakiegokolwiek narzędzia analitycznego, piksela reklamowego lub innej technologii wymagającej zgody poprzedzi baner zgody z równorzędnymi przyciskami „Akceptuję” i „Odrzucam” oraz blokada ładowania odpowiednich skryptów do czasu udzielenia zgody. Do tego momentu Serwis ich nie ładuje.

### 1.5 Korekta zdania w sekcji 2 (do rozważenia)

Obecna sekcja 2 wymienia „zapamiętanie wybranych ustawień” i „obsługę mechanizmu zarządzania zgodami” jako możliwe cele, a w sekcji 5 stwierdza, że baner zgody nie jest wyświetlany. [DO POTWIERDZENIA PRZEZ PRAWNIKA: czy usunąć z listy cel „obsługa mechanizmu zarządzania zgodami”, skoro takiego mechanizmu nie ma.]

---

## 2. Polityka prywatności: konkretny opis przetwarzania zdarzeń

Obecna sekcja 3 jest sformułowana warunkowo („mogą być rejestrowane”, „zależy od konfiguracji”). Poniżej wersja opisująca faktyczne działanie, zgodna z kodem.

### 2.1 Stan faktyczny (z kodu)

- **Wyświetlenie strony** (`PageView`): ścieżka, data i czas, losowy identyfikator sesji, skrót SHA-256 adresu IP (z solą), źródło wejścia (kategoria z nagłówka odsyłającego), identyfikator użytkownika, jeśli jest zalogowany.
- **Kliknięcie „Przejdź do promocji”** (`Click`): promocja, data i czas, identyfikator sesji, skrót SHA-256 z IP i User-Agent (z solą), przycisk źródłowy, ewentualny znacznik kampanii e-mail, kategoria źródła ruchu i parametry `utm_*` z `bmp_attribution`, identyfikator użytkownika, jeśli jest zalogowany.
- **Wyświetlenia promocji**: [DO POTWIERDZENIA: osobny zapis zdarzeń wyświetlenia oferty. Plan 04 wymienia „wyświetlenia”; należy sprawdzić, czy istnieje oddzielny model, czy wystarczy `PageView` dla ścieżki oferty.]
- Powiązanie zdarzeń z kontem następuje po zalogowaniu. Administrator Serwisu widzi aktywność w podziale na użytkowników. [DO POTWIERDZENIA: zakres widoku administratora w panelu, zob. `/admin`.]
- Uwaga techniczna dla właściciela: sól do skrótu jest stałą w kodzie, więc skrót IP należy traktować jako dane osobowe (pseudonimizacja, nie anonimizacja). Zalecenie: rotowana sól albo skracanie adresu IP przed haszowaniem. To zmiana kodu, nie tekstu.

### 2.2 Proponowane brzmienie sekcji „Dane techniczne i zdarzenia w Serwisie”

> Podczas korzystania z Serwisu zapisujemy po stronie serwera następujące zdarzenia:
>
> 1. **Wyświetlenie strony.** Zapisujemy: ścieżkę odwiedzonej strony, datę i godzinę, losowy identyfikator sesji, skrót kryptograficzny (SHA-256, z użyciem tajnego składnika) adresu IP, ogólną kategorię źródła wejścia (wejście bezpośrednie, wyszukiwarka, media społecznościowe albo nazwę domeny odsyłającej) oraz, jeśli użytkownik jest zalogowany, identyfikator jego konta.
> 2. **Kliknięcie w „Przejdź do promocji”.** Zapisujemy: promocję, datę i godzinę, identyfikator sesji, skrót SHA-256 obliczony z adresu IP i danych przeglądarki (User-Agent), informację, który przycisk został użyty, kategorię źródła wejścia i parametry kampanii `utm_*` (jeśli występowały w adresie strony), a dla zalogowanych identyfikator konta.
>
> Nie zapisujemy pełnego adresu IP w tych zdarzeniach. Skrót adresu IP jest jednak powiązany z konkretnym urządzeniem lub łączem, dlatego traktujemy go jako dane osobowe i przetwarzamy zgodnie z RODO.
>
> Dla zalogowanych użytkowników zdarzenia są powiązane z kontem. Administrator Serwisu ma dostęp do podglądu aktywności w podziale na konta. [DO POTWIERDZENIA: czy to zdanie ma pozostać w tej formie.]
>
> Serwis nie korzysta z zewnętrznych narzędzi analitycznych ani reklamowych. Nie tworzymy profili reklamowych i nie podejmujemy decyzji w sposób zautomatyzowany wywołującej skutki prawne wobec użytkownika.

### 2.3 Proponowane brzmienie: cel i podstawa prawna

> **Cel:** zapewnienie bezpieczeństwa i stabilności Serwisu, rozliczenie z partnerami programów afiliacyjnych, zliczanie wejść i kliknięć, ocena, które treści są przydatne, ulepszanie Serwisu.
>
> **Podstawa:** art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes Administratora). Interes polega na rozliczaniu prowizji afiliacyjnych, ochronie przed nadużyciami i analizie korzystania z Serwisu, w tym na zapewnieniu, że wyniki rankingu nie są zniekształcane sztucznym ruchem.
>
> **Test równowagi** [DO POTWIERDZENIA PRZEZ PRAWNIKA: sformułowanie, w tym czy zapis zdarzeń powiązanych z kontem wymaga osobnej podstawy]: zapisujemy ograniczony zestaw danych, bez pełnego adresu IP, bez treści odwiedzanych stron poza ścieżką, bez łączenia z danymi z innych serwisów. Użytkownik może sprzeciwić się przetwarzaniu (sekcja „Prawa użytkownika”) na zasadach art. 21 RODO.

### 2.4 Okres przechowywania

> Zdarzenia opisane w sekcji [numer] przechowujemy [DO POTWIERDZENIA PRZEZ WŁAŚCICIELA: okres, propozycja robocza 13 albo 25 miesięcy], po czym są usuwane lub trwale anonimizowane. Dane konta przechowujemy do czasu usunięcia konta, a następnie przez okres niezbędny do dochodzenia lub obrony przed roszczeniami [DO POTWIERDZENIA: okres].

Uwaga: obecnie w repozytorium nie ma zadania cyklicznie usuwającego zdarzenia. Opublikowanie konkretnego okresu wymaga najpierw zadania backendowego (cron kasujący), poza zakresem redesignu. Do tego czasu tekst nie może obiecywać usuwania.

### 2.5 Odbiorcy z nazwy i transfery poza EOG

> Dane mogą być powierzone lub udostępnione następującym podmiotom (procesorom):
> - [DO POTWIERDZENIA: Vercel Inc. (hosting aplikacji), USA],
> - [DO POTWIERDZENIA: Neon, Inc. (baza danych PostgreSQL), lokalizacja regionu bazy: DO POTWIERDZENIA],
> - [DO POTWIERDZENIA: Resend (wysyłka wiadomości e-mail), USA],
> - [DO POTWIERDZENIA: dostawca poczty obsługującej adres pomoc@bankmiplaci.pl],
> - [DO POTWIERDZENIA: ewentualne systemy afiliacyjne, do których użytkownik jest przekierowywany; ich rola jako odrębnych administratorów].
>
> Transfer danych poza Europejski Obszar Gospodarczy: [DO POTWIERDZENIA: czy dochodzi do transferu; podstawa, np. decyzja Komisji Europejskiej o odpowiednim stopniu ochrony (EU-US Data Privacy Framework) dla podmiotu certyfikowanego albo standardowe klauzule umowne; link do kopii zabezpieczeń].

Nazwy podmiotów pochodzą z konfiguracji projektu (biblioteka `resend` w zależnościach, baza Neon wg dokumentacji projektu, hosting Vercel wg planu 04). Żadna z tych informacji nie została tu potwierdzona umowami powierzenia.

---

## 3. Regulamin: nowe rozdziały

Proponowane miejsce: po obecnym rozdziale 3 „Zasady korzystania z Serwisu”, przed „Odpowiedzialnością”.

### 3.1 Rozdział „Konto użytkownika”

> 1. Korzystanie z podstawowych funkcji Serwisu (przeglądanie promocji, porównywanie) nie wymaga założenia konta.
> 2. Konto jest potrzebne do funkcji takich jak dodawanie komentarzy, zapisywanie dat karencji w „Moje konto” i śledzenie postępów w „Ściądze”. [DO POTWIERDZENIA: aktualna lista funkcji wymagających konta.]
> 3. Założenie konta jest dobrowolne i nieodpłatne. Wymaga podania adresu e-mail, nazwy użytkownika i hasła oraz zaakceptowania Regulaminu i potwierdzenia zapoznania się z Polityką prywatności.
> 4. Umowa o świadczenie usługi prowadzenia konta zawierana jest na czas nieoznaczony. Użytkownik może ją wypowiedzieć w każdym czasie, usuwając konto w ustawieniach konta lub wysyłając wiadomość na adres pomoc@bankmiplaci.pl. [DO POTWIERDZENIA: czy w Serwisie istnieje funkcja samodzielnego usunięcia konta; jeśli nie, zapis o usuwaniu przez e-mail i termin realizacji: DO POTWIERDZENIA.]
> 5. Użytkownik zobowiązuje się podawać prawdziwe dane, chronić hasło i nie udostępniać konta osobom trzecim.
> 6. Operator może zablokować lub usunąć konto w przypadku rażącego lub powtarzającego się naruszenia Regulaminu, po uprzednim wezwaniu do zaprzestania naruszeń, chyba że naruszenie jest tak poważne, że wezwanie byłoby bezcelowe. [DO POTWIERDZENIA PRZEZ PRAWNIKA: tryb i terminy.]
> 7. Po usunięciu konta dane są usuwane lub anonimizowane zgodnie z Polityką prywatności. Komentarze: [DO POTWIERDZENIA: usuwane razem z kontem czy anonimizowane].
> 8. Użytkownicy, którzy założyli konto przed wprowadzeniem tego rozdziału, są informowani o zmianie Regulaminu w sposób opisany w rozdziale o zmianach Regulaminu. [DO POTWIERDZENIA PRZEZ PRAWNIKA: sposób poinformowania istniejących użytkowników i moment wejścia zmian w życie.]

### 3.2 Rozdział „Komentarze”

> 1. Zalogowany użytkownik może dodawać komentarze do promocji. Komentarze wyrażają opinie ich autorów, a nie Operatora, i nie stanowią rekomendacji ani porady.
> 2. Zabronione jest zamieszczanie treści: bezprawnych, naruszających dobra osobiste lub prawa autorskie, wulgarnych, nawołujących do nienawiści, wprowadzających w błąd, zawierających dane osobowe osób trzecich albo dane umożliwiające dostęp do rachunku (numery rachunków, kart, hasła), a także spamu.
> 3. Zabronione jest zamieszczanie linków afiliacyjnych, poleceń lub kodów polecających (w tym własnych) oraz treści reklamowych. Operator usuwa takie komentarze. [DO POTWIERDZENIA: czy zakaz obejmuje także zwykłe linki zewnętrzne.]
> 4. Operator moderuje komentarze: [DO POTWIERDZENIA: moderacja przed publikacją albo po publikacji; stan faktyczny w kodzie do sprawdzenia]. Operator może usunąć lub ukryć komentarz naruszający Regulamin bez uprzedzenia.
> 5. Treść bezprawną można zgłosić na adres pomoc@bankmiplaci.pl, podając adres strony z komentarzem, jego treść i uzasadnienie. Operator rozpatruje zgłoszenie [DO POTWIERDZENIA: termin, propozycja 7 dni] i informuje zgłaszającego o decyzji. Zgłoszenie nie wyłącza prawa do dochodzenia roszczeń przed sądem.
> 6. Autor udziela Operatorowi nieodpłatnej, niewyłącznej licencji na publikację komentarza w Serwisie na czas jego obecności w Serwisie. [DO POTWIERDZENIA PRZEZ PRAWNIKA: zakres licencji.]
> 7. Autor może usunąć swój komentarz [DO POTWIERDZENIA: czy funkcja istnieje] albo zażądać jego usunięcia pocztą e-mail.

Uwaga: rozdział dotyczy usługi hostingu treści w rozumieniu rozporządzenia 2022/2065 (DSA). [DO POTWIERDZENIA PRZEZ PRAWNIKA: obowiązki w zakresie punktu kontaktowego, mechanizmu zgłaszania i uzasadnień decyzji moderacyjnych dla mikroprzedsiębiorcy.]

### 3.3 Informacja o linkach partnerskich

Regulamin już zawiera w rozdziale 2 informacje o modelu afiliacyjnym. Proponowane doprecyzowanie, spójne z planem 04:

> 1. Serwis zarabia na prowizjach, które otrzymuje od banków i innych partnerów, gdy użytkownik przechodzi na ich stronę przez link partnerski i wykona określone działanie (np. otworzy konto). Linki partnerskie są oznaczone [DO POTWIERDZENIA: forma oznaczenia w interfejsie, w kodzie atrybut `rel="sponsored"` i etykieta przy przycisku] i nie zwiększają ceny produktu dla użytkownika.
> 2. Wysokość prowizji nie wpływa na ocenę serwisu ani na zakres informacji o promocji. Sortowanie „Polecane” uwzględnia m.in. wynagrodzenie partnerskie. Sortowania „Najlepsza ocena”, „Najwyższa premia” i pozostałe go nie uwzględniają. Szczegóły opisuje strona „Jak zarabiamy”.
> 3. Serwis nie obejmuje całego rynku. Prezentuje wyłącznie promocje przeanalizowane przez Operatora.

Uwaga: zdanie o sortowaniu „Polecane” opisuje stan zgodny z commitem `eb604b3` i planem 04. Jeżeli algorytm się zmieni, tekst należy zaktualizować. Obecny Regulamin nie wymienia sortowania i nie powinien mu przeczyć. Zdanie o „ocenie” jest zgodne z założeniem projektu (ocena liczona bez prowizji).

---

## 4. Rejestracja: checkbox akceptacji

Wymóg planu 04 §7: niezaznaczony domyślnie checkbox, walidacja po stronie serwera, zapis `termsAcceptedAt` i `termsVersion` (pola dodane w schemacie).

Proponowane brzmienie: „Akceptuję [Regulamin](/regulamin) i potwierdzam zapoznanie się z [Polityką prywatności](/polityka-prywatnosci).”

Do uzgodnienia z pakietem WP-07:
- linki otwierają się w nowej karcie, aby nie utracić wypełnionego formularza (`target="_blank"` wymaga `rel="noopener"` i informacji dla czytników ekranu, np. „(otwiera się w nowej karcie)”),
- układ stron prawnych nie psuje tego scenariusza: strony nie wymagają kotwic, a ich adresy `/regulamin` i `/polityka-prywatnosci` są niezmienione,
- wartość `termsVersion` powinna odpowiadać wersji Regulaminu [DO POTWIERDZENIA: schemat wersjonowania, np. data wejścia w życie].

---

## 5. Klauzula informacyjna pod formularzem kontaktowym

Plan 04 §7 przewiduje klauzulę RODO pod formularzem oraz bezpośredni `mailto`. Formularz kontaktowy nie jest w zakresie WP-14.

> Administratorem danych jest Michał Kamiński, Stawiszyn 7a, 26-800 Białobrzegi. Dane z formularza przetwarzamy w celu udzielenia odpowiedzi (art. 6 ust. 1 lit. f RODO). Szczegóły i prawa użytkownika opisuje [Polityka prywatności](/polityka-prywatnosci). [DO POTWIERDZENIA: okres przechowywania korespondencji.]

---

## 6. Kwestie do decyzji właściciela i prawnika (zestawienie)

1. Czy `bmp_attribution` w sessionStorage zostaje (wymaga oceny prawnej), czy atrybucja przechodzi na serwer.
2. Okres przechowywania zdarzeń (propozycja 13 albo 25 miesięcy) i zadanie backendowe usuwające dane.
3. Lista procesorów (Vercel, Neon, Resend, poczta) i transfery poza EOG, w tym umowy powierzenia.
4. Rotacja soli skrótu IP lub skracanie IP (zmiana w kodzie, osobne zadanie).
5. Tryb moderacji komentarzy, termin rozpatrywania zgłoszeń, obowiązki DSA.
6. Funkcja samodzielnego usunięcia konta i los komentarzy po usunięciu.
7. Sposób powiadomienia istniejących użytkowników o zmianie Regulaminu i data wejścia zmian w życie. Po wprowadzeniu zmian trzeba zaktualizować daty „Data wejścia w życie” i „Data ostatniej aktualizacji” na stronach.
8. Zgody marketingowe na przypomnienia e-mail „Możesz już skorzystać” (informacja handlowa, `List-Unsubscribe`, stopka wypisu): poza zakresem redesignu, zob. `docs/reminder-consent-store-design.md`.
