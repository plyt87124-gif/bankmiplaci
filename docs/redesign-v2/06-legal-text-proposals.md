# 06. Propozycje zmian w tekstach prawnych (do przeglądu prawnika)

Status: PROPOZYCJE. Żadne z poniższych brzmień NIE jest opublikowane na stronie. Strony `/regulamin`, `/polityka-prywatnosci` i `/cookies` zachowały dotychczasową treść prawną (zmieniono wyłącznie układ, typografię i dostępność). Źródło zakresu: `04-trust-and-disclosure-plan.md` §7 oraz pakiet WP-14.

Konwencje:
- `[DO POTWIERDZENIA]` oznacza wartość lub fakt, którego nie da się ustalić z kodu albo który wymaga decyzji właściciela lub prawnika. Nie wolno publikować brzmienia z takim znacznikiem.
- Opisy techniczne poniżej wynikają z kodu repozytorium na dzień 2026-10-09 (modele `PageView`, `Impression`, `Click`, komponenty `AttributionCapture`, `PromotionImpression`, `AffiliateCtaLink`, plik `attributionHref.ts`, `theme.ts`, `visitorHash.ts`, `userActivity.ts`, trasy `/out/[slug]` i `/api/track/*`, model `AdminNotification`). Każde twierdzenie faktyczne sprawdzono wyszukiwaniem w kodzie; to, czego z kodu nie da się ustalić, ma znacznik `[DO POTWIERDZENIA]`. Zmiana kodu wymaga aktualizacji tekstu.
- Numeracja punktów jest robocza; wstawienie nowych rozdziałów przesunie numerację w odsyłaczach wewnętrznych (np. „patrz sekcja 6” w Cookies).

---

## 1. Cookies: dopisanie localStorage i sessionStorage

### 1.1 Stan faktyczny (z kodu)

| Klucz | Miejsce | Cel | Zawartość | Czas |
|---|---|---|---|---|
| `theme` | `localStorage` | zapamiętanie wybranego motywu (jasny, ciemny, systemowy) | jedna z wartości `light`, `dark`, `system` | do usunięcia przez użytkownika (brak wygasania) |
| `bmp_attribution` | `sessionStorage` | zapamiętanie źródła wejścia (parametry `utm_*` i sklasyfikowane źródło ruchu: bezpośrednie, wyszukiwarka, social, domena) do późniejszego powiązania z wyświetleniem oferty i kliknięciem „Przejdź do promocji” | parametry `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (o ile były w adresie), `trafficSource`, znacznik czasu | do zamknięcia karty; dodatkowo odczyt ignoruje wpis starszy niż 24 godziny |

`bmp_attribution` nie jest wysyłany na serwer automatycznie (nie jest cookie ani nagłówkiem). Zapis powstaje przy pierwszym wejściu w danej karcie (pierwsze źródło), a nadpisuje go dopiero nowe wejście z adresu zawierającego `utm_*`. Zawartość jest odczytywana przez kod strony w dwóch miejscach:

1. **Wyświetlenie oferty** (`PromotionImpression`, strona szczegółów promocji): `trafficSource` i `utm_*` są wysyłane w treści żądania `POST /api/track/impression` i zapisywane w tabeli `Impression`.
2. **Link „Przejdź do promocji”** (`AffiliateCtaLink` i `attributionHref.ts`): `utm_*` oraz `traffic_source` są doklejane jako parametry adresu `/out/…` i po kliknięciu zapisywane w tabeli `Click`. Parametry te są widoczne w adresie w przeglądarce użytkownika.

**Zasięg zapisu.** `AttributionCapture` nie jest montowany w layoucie, tylko na pięciu stronach: stronie głównej (`src/app/page.tsx`), `/porownaj`, `/promocje` (lista), `/promocje/[slug]` i `/quiz`. Wejście w danej karcie na inną stronę (np. blog, FAQ, strony prawne) niczego nie zapisuje; zapis powstaje dopiero po wejściu na jedną z tych pięciu. Odczyt `utm_*` następuje z adresu strony w chwili jej wyświetlenia (`window.location.search`), więc przejście z innej strony Serwisu na jedną z pięciu nie przenosi parametrów z adresu pierwszego wejścia. Dlatego opis w tekście publicznym mówi o „wybranych stronach Serwisu”, a nie o całym Serwisie. [DO POTWIERDZENIA PRZEZ WŁAŚCICIELA: czy mechanizm ma pozostać na tych pięciu stronach, czy ma działać w layoucie na wszystkich stronach. Zmiana zakresu wymaga aktualizacji opisu poniżej i oceny prawnej z punktu 1.2.]

W obu przypadkach wpis starszy niż 24 godziny jest pomijany. [DO POTWIERDZENIA: czy przekierowanie do partnera przekazuje te parametry dalej; z kodu `/out/[slug]` wynika tylko, że odczytuje je z adresu żądania do zapisu `Click`.]

### 1.2 Proponowane brzmienie: nowa sekcja w „Cookies” (po sekcji 2 lub jako 2a)

> **Pamięć lokalna przeglądarki (localStorage i sessionStorage)**
>
> Oprócz plików cookies Serwis korzysta z pamięci przeglądarki użytkownika (Web Storage). Dane te nie są automatycznie wysyłane do serwera przy każdym żądaniu, jak ma to miejsce w przypadku cookies.
>
> 1. Klucz `theme` (localStorage): zapamiętuje wybrany przez użytkownika motyw wyglądu strony (jasny, ciemny albo zgodny z ustawieniem urządzenia). Ma charakter funkcjonalny i jest zapisywany wyłącznie po wybraniu motywu przez użytkownika. Wpis można usunąć w ustawieniach przeglądarki. [DO POTWIERDZENIA: czy zapis następuje wyłącznie po aktywnym wyborze, czy także przy pierwszym wejściu. Z kodu: zapis przy zmianie preferencji.]
> 2. Klucz `bmp_attribution` (sessionStorage): zapamiętuje, z jakiego źródła użytkownik wszedł na wybrane strony Serwisu (strona główna, lista promocji, strona szczegółów promocji, porównanie i quiz): wartości parametrów `utm_*` z adresu strony oraz ogólna kategoria źródła: wejście bezpośrednie, wyszukiwarka, media społecznościowe albo nazwa domeny odsyłającej. Wpis jest usuwany po zamknięciu karty przeglądarki. Zawartość wpisu jest przesyłana do Serwisu w dwóch sytuacjach: przy wyświetleniu strony szczegółów promocji (zapis wyświetlenia oferty) oraz po kliknięciu w link „Przejdź do promocji” (zapis kliknięcia); patrz Polityka prywatności. Sam wpis nie zawiera danych identyfikujących użytkownika, ale zapisane w Serwisie zdarzenia mogą być powiązane z kontem zalogowanego użytkownika.
>
> [DO POTWIERDZENIA PRZEZ PRAWNIKA: czy zapis `bmp_attribution` stanowi „niezbędny” dostęp do urządzenia (art. 173 Prawa telekomunikacyjnego) i może funkcjonować bez zgody. Plan 04 §7 wskazuje opcję bezpieczną: usunięcie zapisu do sessionStorage i przekazywanie atrybucji wyłącznie w parametrach żądania lub po stronie serwera. Jeżeli prawnik uzna zgodę za wymaganą, bez banera zgody ten mechanizm należy wyłączyć, a opis powyżej nie jest publikowany.]

### 1.3 Proponowane uzupełnienie tabeli w sekcji 6 „Lista wykorzystywanych cookies”

Zmiana tytułu sekcji na „Lista wykorzystywanych cookies i pamięci przeglądarki” oraz dwa nowe wiersze:

| Nazwa | Dostawca | Cel | Rodzaj | Okres przechowywania |
|---|---|---|---|---|
| `theme` (localStorage) | Bankmiplaci (własny) | Zapamiętanie wybranego motywu wyglądu | Funkcjonalny | Do usunięcia przez użytkownika |
| `bmp_attribution` (sessionStorage) | Bankmiplaci (własny) | Zapamiętanie źródła wejścia do powiązania z wyświetleniem oferty i kliknięciem „Przejdź do promocji” | [DO POTWIERDZENIA: kwalifikacja: niezbędny / funkcjonalny / analityczny] | Do zamknięcia karty (maks. 24 godziny) |

### 1.4 Proponowane zdanie o przyszłych narzędziach (sekcja 5 lub 3)

> Wdrożenie jakiegokolwiek narzędzia analitycznego, piksela reklamowego lub innej technologii wymagającej zgody poprzedzi baner zgody z równorzędnymi przyciskami „Akceptuję” i „Odrzucam” oraz blokada ładowania odpowiednich skryptów do czasu udzielenia zgody. Do tego momentu Serwis ich nie ładuje.

### 1.5 Korekta zdania w sekcji 2 (do rozważenia)

Obecna sekcja 2 wymienia „zapamiętanie wybranych ustawień” i „obsługę mechanizmu zarządzania zgodami” jako możliwe cele, a w sekcji 5 stwierdza, że baner zgody nie jest wyświetlany. [DO POTWIERDZENIA PRZEZ PRAWNIKA: czy usunąć z listy cel „obsługa mechanizmu zarządzania zgodami”, skoro takiego mechanizmu nie ma.]

---

## 2. Polityka prywatności: konkretny opis przetwarzania zdarzeń

Obecna sekcja 3 jest sformułowana warunkowo („mogą być rejestrowane”, „zależy od konfiguracji”). Poniżej wersja opisująca faktyczne działanie, zgodna z kodem.

### 2.1 Stan faktyczny (z kodu)

- **Wyświetlenie strony** (`PageView`, `POST /api/track/pageview`, wywoływane przez `PageViewTracker` przy każdej zmianie ścieżki): ścieżka, data i czas, `sessionId` (nowy losowy UUID generowany przy każdym żądaniu, więc nie łączy odsłon w jedną sesję), skrót SHA-256 z adresu IP i User-Agent, źródło wejścia (kategoria klasyfikowana w przeglądarce na podstawie `document.referrer` i wysyłana do serwera przez stronę), identyfikator użytkownika, jeśli jest zalogowany. Parametry `utm_*` nie są tu zapisywane.
- **Wyświetlenie oferty** (`Impression`, `POST /api/track/impression`, wywoływane przez `PromotionImpression` na stronie szczegółów promocji): promocja, data i czas, `sessionId` (nowy losowy UUID przy każdym zapisie), pole `source` (`referral` albo `direct`, wg obecności `document.referrer`), `trafficSource` oraz `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` z `bmp_attribution` (o ile istnieje i nie jest starszy niż 24 godziny), identyfikator użytkownika, jeśli jest zalogowany. Tabela `Impression` nie ma pola ze skrótem adresu IP. Każde zapisane wyświetlenie oferty tworzy dodatkowo powiadomienie administratora (`AdminNotification`, typ `PROMOTION_VIEW`), które dla zalogowanego użytkownika zawiera jego nazwę lub adres e-mail. [DO POTWIERDZENIA: czy ujawnić to w Polityce prywatności jako dostęp administratora do aktywności kont; okres przechowywania powiadomień.]
- **Kliknięcie „Przejdź do promocji”** (`Click`, trasa `/out/[slug]`): promocja, data i czas, `sessionId` (nowy losowy UUID), skrót SHA-256 z adresu IP i User-Agent, przycisk źródłowy (`src`), ewentualny znacznik kampanii e-mail (`cmp`), `traffic_source` i `utm_*` odczytane z adresu żądania (doklejone z `bmp_attribution`), identyfikator użytkownika, jeśli jest zalogowany. Kliknięcia powtórzone przez ten sam skrót w krótkim oknie czasowym są pomijane (deduplikacja), a kliknięcia wykrytych robotów i użytkowników wewnętrznych (`isLikelyBot`, `isInternalUser`) nie są zapisywane. Zapis `Click` powstaje dopiero po przejściu bramek dostępności promocji i aktywnego linku partnerskiego (przy ofercie niedostępnej trasa tylko przekierowuje na stronę serwisu i niczego nie zapisuje).
- **Powiadomienie administratora o kliknięciu** (`AdminNotification`, typ `PROMOTION_CLICK`, trasa `/out/[slug]`): każde zapisane kliknięcie tworzy w tej samej transakcji powiadomienie dla administratora (osobny dzwonek „Kliknięcia w linki afiliacyjne” w panelu `/admin`). Jego treść zawiera nazwę użytkownika albo jego adres e-mail (gdy jest zalogowany, w przeciwnym razie napis „Niezalogowany użytkownik”) oraz nazwę banku i promocji; zapisywany jest też identyfikator użytkownika (`relatedUserId`) i promocji. Powiadomienie nie powstaje tam, gdzie nie powstaje `Click` (duplikat w oknie deduplikacji, rozpoznany robot, użytkownik wewnętrzny). Jest to odpowiednik powiadomienia `PROMOTION_VIEW` dla wyświetleń ofert. [DO POTWIERDZENIA: okres przechowywania powiadomień (w kodzie nie znaleziono ich usuwania) i czy ujawnić ten dostęp administratora w Polityce prywatności.]
- **Znacznik ostatniej aktywności konta** (`User.lastActiveAt`, funkcja `touchUserActivity` w `src/lib/userActivity.ts`): dla zalogowanego użytkownika serwer nadpisuje jedną wartość (data i godzina ostatniej aktywności, bez historii) przy: zapisie wyświetlenia strony (`/api/track/pageview`), zapisie wyświetlenia oferty (`/api/track/impression`), przejściu przez `/out/[slug]` (po bramkach dostępności z poprzedniego punktu), działaniach w „Ściądze” (`/api/checklist/complete`, `join`, `opened-at`, `toggle`), dodaniu komentarza i polubieniu komentarza. Zapis następuje przed bramkami „użytkownik wewnętrzny” i „robot”, więc dotyczy także kont użytkowników wewnętrznych. Wartość jest widoczna dla administratora w `/admin/uzytkownicy` („Ostatnio aktywny/a”, wskaźnik „aktywny/a”, filtr „Tylko online” i sortowanie „Ostatnio aktywni”). Kod opisuje ją jako sygnał obecności dla panelu administratora, nie jako „ostatnie logowanie”. [DO POTWIERDZENIA: czy ujawnić ten znacznik w Polityce prywatności jako element widoku aktywności kont dostępnego administratorowi; podstawa i okres przechowywania są takie jak danych konta.]
- Zdarzenia użytkowników wewnętrznych (`isInternalUser`) nie są zapisywane także dla `PageView` i `Impression`.
- Powiązanie zdarzeń z kontem: jeśli użytkownik jest zalogowany (ciasteczko sesji, `src/lib/userSession.ts`), `userId` jest zapisywany w `PageView`, `Impression` i `Click`. Zgodnie z komentarzami w schemacie Administrator Serwisu ma widok aktywności per użytkownik („co ten użytkownik oglądał / kliknął”), a ponadto powiadomienia `PROMOTION_VIEW` i `PROMOTION_CLICK` z nazwą lub adresem e-mail oraz znacznik `lastActiveAt` opisane wyżej. Po usunięciu konta `userId` w tych zdarzeniach jest zerowany (`onDelete: SetNull`), a samo zdarzenie zostaje. [DO POTWIERDZENIA: pełny zakres widoku administratora w panelu `/admin`.]
- Uwaga techniczna dla właściciela: do skrótu dodawany jest stały ciąg („pepper”) zapisany w kodzie źródłowym (`src/lib/visitorHash.ts`), razem z adresem IP i User-Agent. To nie jest sekret przechowywany poza kodem ani losowa sól per rekord, a komentarz w kodzie wprost stwierdza, że celem jest deduplikacja, nie bezpieczeństwo kryptograficzne. Skrót należy traktować jako dane osobowe (pseudonimizacja, nie anonimizacja). Zalecenie: rotowany sekret ze zmiennej środowiskowej albo skracanie adresu IP przed haszowaniem. To zmiana kodu, nie tekstu.

### 2.2 Proponowane brzmienie sekcji „Dane techniczne i zdarzenia w Serwisie”

> Podczas korzystania z Serwisu zapisujemy po stronie serwera następujące zdarzenia:
>
> 1. **Wyświetlenie strony.** Zapisujemy: ścieżkę odwiedzonej strony, datę i godzinę, losowy identyfikator sesji, skrót kryptograficzny (SHA-256) obliczony z adresu IP i danych przeglądarki (User-Agent) z dodaniem stałego ciągu znaków, ogólną kategorię źródła wejścia (wejście bezpośrednie, wyszukiwarka, media społecznościowe albo nazwę domeny odsyłającej) oraz, jeśli użytkownik jest zalogowany, identyfikator jego konta.
> 2. **Wyświetlenie strony szczegółów promocji.** Zapisujemy: promocję, datę i godzinę, losowy identyfikator, informację, czy użytkownik przyszedł z innej strony, kategorię źródła wejścia i parametry kampanii `utm_*` (jeśli występowały w adresie, którym użytkownik wszedł do Serwisu w danej karcie przeglądarki), a dla zalogowanych identyfikator konta.
> 3. **Kliknięcie w „Przejdź do promocji”.** Zapisujemy: promocję, datę i godzinę, losowy identyfikator, skrót SHA-256 obliczony z adresu IP i danych przeglądarki (User-Agent), informację, który przycisk został użyty, kategorię źródła wejścia i parametry kampanii `utm_*` (jak wyżej), a dla zalogowanych identyfikator konta. Parametry te są dołączane do adresu przekierowania w Serwisie (`/out/…`). Przy każdym zapisanym wyświetleniu strony szczegółów promocji i każdym zapisanym kliknięciu tworzymy też powiadomienie dla administratora, które zawiera nazwę użytkownika lub jego adres e-mail (gdy jest zalogowany) oraz nazwę promocji. [DO POTWIERDZENIA: okres przechowywania powiadomień.]
> 4. **Ostatnia aktywność konta.** Dla zalogowanego użytkownika zapisujemy datę i godzinę jego ostatniej aktywności w Serwisie (wyświetlenie strony lub oferty, kliknięcie „Przejdź do promocji”, korzystanie ze „Ściągi”, dodanie lub polubienie komentarza). Zapisujemy tylko ostatnią wartość, bez historii. [DO POTWIERDZENIA: czy zdanie ma pozostać w tej formie.]
>
> Nie zapisujemy pełnego adresu IP w tych zdarzeniach. Skrót adresu IP (przy wyświetleniach stron i kliknięciach) jest jednak powiązany z konkretnym urządzeniem lub łączem, dlatego traktujemy go jako dane osobowe i przetwarzamy zgodnie z RODO.
>
> Dla zalogowanych użytkowników zdarzenia są powiązane z kontem. Administrator Serwisu ma dostęp do podglądu aktywności w podziale na konta, w tym do daty ostatniej aktywności konta oraz do powiadomień o wyświetleniu oferty i kliknięciu „Przejdź do promocji”, w których widoczna jest nazwa użytkownika lub jego adres e-mail. Po usunięciu konta powiązanie z kontem jest usuwane, a zdarzenie pozostaje w postaci niepowiązanej z osobą. [DO POTWIERDZENIA: czy to zdanie ma pozostać w tej formie.]
>
> Serwis nie korzysta z zewnętrznych narzędzi analitycznych ani reklamowych [DO POTWIERDZENIA: w kodzie źródłowym nie sprawdzano wszystkich skryptów; zweryfikować także konfigurację hostingu]. Nie tworzymy profili reklamowych i nie podejmujemy decyzji w sposób zautomatyzowany wywołującej skutki prawne wobec użytkownika.

### 2.3 Proponowane brzmienie: cel i podstawa prawna

> **Cel:** zapewnienie bezpieczeństwa i stabilności Serwisu, rozliczenie z partnerami programów afiliacyjnych, zliczanie wejść i kliknięć, ocena, które treści są przydatne, ulepszanie Serwisu.
>
> **Podstawa:** art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes Administratora). Interes polega na rozliczaniu prowizji afiliacyjnych, ochronie przed nadużyciami i analizie korzystania z Serwisu, w tym na zapewnieniu, że wyniki rankingu nie są zniekształcane sztucznym ruchem.
>
> **Test równowagi** [DO POTWIERDZENIA PRZEZ PRAWNIKA: sformułowanie, w tym czy zapis zdarzeń powiązanych z kontem wymaga osobnej podstawy]: zapisujemy ograniczony zestaw danych, bez pełnego adresu IP, bez treści odwiedzanych stron poza ścieżką, bez łączenia z danymi z innych serwisów. Użytkownik może sprzeciwić się przetwarzaniu (sekcja „Prawa użytkownika”) na zasadach art. 21 RODO.

### 2.4 Okres przechowywania

> Zdarzenia opisane w sekcji [numer] przechowujemy [DO POTWIERDZENIA PRZEZ WŁAŚCICIELA: okres, propozycja robocza 13 albo 25 miesięcy], po czym są usuwane lub trwale anonimizowane. Dane konta przechowujemy do czasu usunięcia konta, a następnie przez okres niezbędny do dochodzenia lub obrony przed roszczeniami [DO POTWIERDZENIA: okres].

Uwaga: obecnie w repozytorium nie ma zadania cyklicznie usuwającego zdarzenia (zadania cron w `src/app/api/cron` dotyczą sprawdzania kwalifikowalności, przypomnień ściągi, katalogu eBroker, wygaszania promocji i przeliczania ocen). Opublikowanie konkretnego okresu wymaga najpierw zadania backendowego (cron kasujący), poza zakresem redesignu. Do tego czasu tekst nie może obiecywać usuwania.

### 2.5 Odbiorcy z nazwy i transfery poza EOG

> Dane mogą być powierzone lub udostępnione następującym podmiotom (procesorom):
> - [DO POTWIERDZENIA: Vercel Inc. (hosting aplikacji), USA],
> - [DO POTWIERDZENIA: Neon, Inc. (baza danych PostgreSQL), lokalizacja regionu bazy: DO POTWIERDZENIA],
> - [DO POTWIERDZENIA: Resend (wysyłka wiadomości e-mail), USA],
> - [DO POTWIERDZENIA: dostawca poczty obsługującej adres pomoc@bankmiplaci.pl],
> - [DO POTWIERDZENIA: ewentualne systemy afiliacyjne, do których użytkownik jest przekierowywany; ich rola jako odrębnych administratorów].
>
> Transfer danych poza Europejski Obszar Gospodarczy: [DO POTWIERDZENIA: czy dochodzi do transferu; podstawa, np. decyzja Komisji Europejskiej o odpowiednim stopniu ochrony (EU-US Data Privacy Framework) dla podmiotu certyfikowanego albo standardowe klauzule umowne; link do kopii zabezpieczeń].

Nazwy podmiotów: biblioteka `resend` jest w `package.json`; baza Neon i hosting Vercel wynikają z dokumentacji projektu i planu 04, nie z kodu, więc wymagają potwierdzenia. Żadna z tych informacji nie została tu potwierdzona umowami powierzenia.

---

## 3. Regulamin: nowe rozdziały

Proponowane miejsce: po obecnym rozdziale 3 „Zasady korzystania z Serwisu”, przed „Odpowiedzialnością”.

### 3.1 Rozdział „Konto użytkownika”

> 1. Korzystanie z podstawowych funkcji Serwisu (przeglądanie promocji, porównywanie) nie wymaga założenia konta.
> 2. Konto jest potrzebne do funkcji takich jak dodawanie komentarzy (API komentarzy zwraca błąd 401 dla niezalogowanych) oraz śledzenie postępów w „Ściądze” (trasy `/api/checklist/*`). [DO POTWIERDZENIA: aktualna lista funkcji wymagających konta.]
> 3. Założenie konta jest dobrowolne i nieodpłatne. Wymaga podania adresu e-mail, nazwy użytkownika i hasła oraz zaakceptowania Regulaminu i potwierdzenia zapoznania się z Polityką prywatności.
> 4. Umowa o świadczenie usługi prowadzenia konta zawierana jest na czas nieoznaczony. Użytkownik może ją wypowiedzieć w każdym czasie, usuwając konto w ustawieniach konta lub wysyłając wiadomość na adres pomoc@bankmiplaci.pl. [DO POTWIERDZENIA: w kodzie nie znaleziono funkcji samodzielnego usunięcia konta przez użytkownika (`/api/account` ma trasy register, login, logout, me, forgot-password, reset-password); konto usuwa administrator (`deleteUserAccount` w panelu). Zapis o usunięciu w ustawieniach konta nie może być opublikowany, dopóki taka funkcja nie powstanie; termin realizacji żądania e-mailowego: DO POTWIERDZENIA.]
> 5. Użytkownik zobowiązuje się podawać prawdziwe dane, chronić hasło i nie udostępniać konta osobom trzecim.
> 6. Operator może zablokować lub usunąć konto w przypadku rażącego lub powtarzającego się naruszenia Regulaminu, po uprzednim wezwaniu do zaprzestania naruszeń, chyba że naruszenie jest tak poważne, że wezwanie byłoby bezcelowe. [DO POTWIERDZENIA PRZEZ PRAWNIKA: tryb i terminy.]
> 7. Po usunięciu konta dane są usuwane lub anonimizowane zgodnie z Polityką prywatności. Komentarze: z kodu wynika, że są usuwane razem z kontem (`Comment.user` z `onDelete: Cascade`). [DO POTWIERDZENIA: czy takie jest zamierzone zachowanie.]
> 8. Użytkownicy, którzy założyli konto przed wprowadzeniem tego rozdziału, są informowani o zmianie Regulaminu w sposób opisany w rozdziale o zmianach Regulaminu. [DO POTWIERDZENIA PRZEZ PRAWNIKA: sposób poinformowania istniejących użytkowników i moment wejścia zmian w życie.]

### 3.2 Rozdział „Komentarze”

> 1. Zalogowany użytkownik może dodawać komentarze do promocji. Komentarze wyrażają opinie ich autorów, a nie Operatora, i nie stanowią rekomendacji ani porady.
> 2. Zabronione jest zamieszczanie treści: bezprawnych, naruszających dobra osobiste lub prawa autorskie, wulgarnych, nawołujących do nienawiści, wprowadzających w błąd, zawierających dane osobowe osób trzecich albo dane umożliwiające dostęp do rachunku (numery rachunków, kart, hasła), a także spamu.
> 3. Zabronione jest zamieszczanie linków afiliacyjnych, poleceń lub kodów polecających (w tym własnych) oraz treści reklamowych. Operator usuwa takie komentarze. [DO POTWIERDZENIA: czy zakaz obejmuje także zwykłe linki zewnętrzne.]
> 4. Operator moderuje komentarze: [DO POTWIERDZENIA: z kodu wynika moderacja po publikacji: komentarz pojawia się od razu, a administrator może go usunąć lub przypiąć w panelu (`/admin/komentarze`); model `Comment` nie ma statusu akceptacji]. Operator może usunąć lub ukryć komentarz naruszający Regulamin bez uprzedzenia.
> 5. Treść bezprawną można zgłosić na adres pomoc@bankmiplaci.pl, podając adres strony z komentarzem, jego treść i uzasadnienie. Operator rozpatruje zgłoszenie [DO POTWIERDZENIA: termin, propozycja 7 dni] i informuje zgłaszającego o decyzji. Zgłoszenie nie wyłącza prawa do dochodzenia roszczeń przed sądem.
> 6. Autor udziela Operatorowi nieodpłatnej, niewyłącznej licencji na publikację komentarza w Serwisie na czas jego obecności w Serwisie. [DO POTWIERDZENIA PRZEZ PRAWNIKA: zakres licencji.]
> 7. Autor może zażądać usunięcia swojego komentarza pocztą e-mail. [DO POTWIERDZENIA: w kodzie nie znaleziono funkcji samodzielnego usunięcia ani edycji komentarza przez autora (są dodawanie i polubienie); nie obiecywać jej w tekście.]

Uwaga: rozdział dotyczy usługi hostingu treści w rozumieniu rozporządzenia 2022/2065 (DSA). [DO POTWIERDZENIA PRZEZ PRAWNIKA: obowiązki w zakresie punktu kontaktowego, mechanizmu zgłaszania i uzasadnień decyzji moderacyjnych dla mikroprzedsiębiorcy.]

### 3.3 Informacja o linkach partnerskich

Regulamin już zawiera w rozdziale 2 informacje o modelu afiliacyjnym. Proponowane doprecyzowanie, spójne z planem 04:

> 1. Serwis zarabia na prowizjach, które otrzymuje od banków i innych partnerów, gdy użytkownik przechodzi na ich stronę przez link partnerski i wykona określone działanie (np. otworzy konto). Linki partnerskie są oznaczone [DO POTWIERDZENIA: forma oznaczenia w interfejsie, w kodzie atrybut `rel="sponsored nofollow noopener noreferrer"` (`AFFILIATE_LINK_REL`) oraz oznaczenie przy przycisku (`AffiliateDisclosure`)] i nie zwiększają ceny produktu dla użytkownika.
> 2. Wysokość prowizji nie wpływa na ocenę serwisu ani na zakres informacji o promocji. Domyślne sortowanie „Polecane” uwzględnia wynagrodzenie partnerskie jako czynnik, który zmienia wynik silniej niż różnice między ocenami serwisu, więc oferta o wyraźnie niższej ocenie może znaleźć się w nim wyżej niż oferta o wyraźnie wyższej. Sortowania „Najlepsza ocena”, „Najwyższa premia” i pozostałe nie uwzględniają prowizji. Szczegóły opisuje strona „Jak zarabiamy”. [DO POTWIERDZENIA PRZEZ PRAWNIKA: czy takie brzmienie wystarcza jako ujawnienie głównych parametrów rankingu (Omnibus, UOKiK). Podstawa faktyczna z kodu: kolejność „Polecane” to ocena serwisu pomnożona przez współczynnik wynagrodzenia z przedziału od 0,6 do 1,0 (`src/lib/recommended.ts`, `COMMISSION_WEIGHT` = 0,4), liczony w obrębie typu konta wśród aktualnie wyświetlanych ofert; przy wynagrodzeniu równym zero współczynnik wynosi 0,6, przy braku danych 0,8. Pozostałe sortowania są sortowaniami bazy danych (`sortToOrderBy` w `src/lib/services/promotions.ts`) i nie odczytują prowizji; pilnuje tego test w `tests/content-pages.test.tsx`. Nie publikować wag liczbowych bez decyzji właściciela.]
> 3. Serwis nie obejmuje całego rynku. Prezentuje wyłącznie promocje przeanalizowane przez Operatora.

Uwaga: zdanie o sortowaniu „Polecane” opisuje stan zgodny z commitem `eb604b3`, `src/lib/recommended.ts` i planem 04. Jeżeli algorytm się zmieni, tekst należy zaktualizować. Obecny Regulamin nie wymienia sortowania i nie powinien mu przeczyć. Zdanie o „ocenie” jest zgodne z założeniem projektu (ocena liczona bez prowizji).

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
8. Ujawnienie rankingu „Polecane” (Omnibus, UOKiK): czy brzmienie na stronie „Jak zarabiamy”, w pasku nad listą i przy sortowaniu (obecnie pasek: „zależy od oceny serwisu i od wynagrodzenia partnerskiego od banków – oferta o niższej ocenie może znaleźć się wyżej”; etykieta sortowania: „Polecane (z wynagrodzeniem)”) wystarczająco jasno mówi, że wynagrodzenie może przeważyć nad różnicami w ocenie.
9. Ujawnienie w Polityce prywatności dostępu administratora do aktywności kont: powiadomienia `PROMOTION_VIEW` i `PROMOTION_CLICK` z nazwą lub e-mailem oraz `lastActiveAt` (punkt 2.1), także dla użytkowników wewnętrznych; okres przechowywania powiadomień.
10. Zasięg `AttributionCapture` (pięć stron czy cały layout) i opis w punkcie 1.1.
11. Zgody marketingowe na przypomnienia e-mail „Możesz już skorzystać” (informacja handlowa, `List-Unsubscribe`, stopka wypisu): poza zakresem redesignu, zob. `docs/reminder-consent-store-design.md`.
