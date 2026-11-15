# Wzorzec promocji: jak ma wyglądać dodawana promocja i co musi być w każdej sekcji

Źródło prawdy dla każdego, kto tworzy promocję: dzienny agent ofert (`bankmiplaci-ebroker-daily`), sesje Claude Code i człowiek w panelu admina.
Zebrane z poleceń i poprawek właściciela (sierpień–listopad 2026). Odpowiada mu skill `bankmiplaci-wzorzec-promocji` (ten sam tekst, w skrócie).
Część reguł pilnuje kod (`scripts/add-promotion-with-checklist.ts`, `src/lib/feeValidation.ts`, `src/lib/offerCopyRules.ts`, `tests/promotion-pattern.test.ts`). Reszta jest oceną: sprawdź ją sam przed zapisem.

## 0. Zasady, które wygrywają z pośpiechem
1. **Nie wymyślasz danych.** Kwoty, terminy, opłaty, warunki, progi: tylko z dokumentu, który faktycznie przeczytałeś. Brak pewności = puste pole (`null`) i dopisek „do sprawdzenia” w raporcie. Nie zaokrąglasz, nie uzupełniasz z pamięci o typowych cenach banku.
2. **Źródła w tej kolejności:** (a) strona promocji banku, (b) regulamin promocji (PDF), (c) taryfa opłat albo dokument dotyczący opłat (osobno), (d) w ostateczności link afiliacyjny. Promocja wygasła, a kampania nadal jest w sieci: to prawie zawsze nowa edycja. Otwórz stronę promocji banku, regulamin i sprawdź kolejne numery edycji w nazwach plików. Wyszukiwarka i serwisy porównawcze nie wystarczą.
3. **ACTIVE czy DRAFT.** Plik kandydata ma zawsze `"status": "DRAFT"`. ACTIVE nadaje flaga skryptu i tylko wtedy, gdy znasz ze źródła: daty (start i ostatni dzień zapisów), premię, wszystkie warunki i kroki ściągi. W innym przypadku DRAFT i w raporcie lista braków.
4. **Nie duplikujesz.** Sprawdź bank, podobną nazwę, kwotę i termin. Nowa edycja to osobna oferta (osobny slug), stara zostaje.
5. **Nie edytujesz istniejących promocji** (wyjątki: przedłużenie z dowodem, link/sieć/prowizja przez `affiliate-sync.ts links`). Błąd w już zapisanej promocji zgłaszasz właścicielowi; poprawia go skrypt korekty z `scripts/data-corrections/` (próba, potwierdzenie, wycofanie), nigdy ręczny zapis na produkcji.
6. Po polsku, krótko, bez ozdobników. Kwoty „5000 zł”, daty „31.12.2026”.

## 1. Mapa: sekcja strony → pole w pliku kandydata
| Na stronie | Pole | Co ma tam być |
|---|---|---|
| Tytuł | `name` | „Nazwa promocji: do X zł z …”, **bez nazwy banku** (strona dokłada ją sama). Numer edycji w nawiasie, gdy jest („Rozpędź swój biznes (4. edycja): do 5000 zł z Kontem Otwartym na Biznes”). |
| Adres | `slug` | małe litery i myślniki: `bank-nazwa-edycja-do-kwota-zl`. Bank musi już istnieć (`bankSlug`). |
| Kwota w tytule i na kafelku | `maxBonusCents` | w groszach; **= suma `bonusParts` = suma `rewardCents` w ściądze** (skrypt to sprawdza). |
| Krótki opis (kafelek, wyszukiwarka) | `summary` | 1–2 zdania: ile i za co, jedno główne wymaganie. **Do 160 znaków.** Bez porównań („najwyższa”, „w tym zestawieniu”). |
| Pasek faktów | `endDate`, `difficulty`, `cooldown*`, `fees` | patrz niżej. Karencja jako skrót i link „Szczegóły karencji” składa strona sama. |
| „Ile dostaniesz: składniki premii” | `bonusParts[]` | jedna pozycja na składnik („12 nagród miesięcznych po 75 zł …”), `amountCents`, `order`. Bez zdania „Premia maksymalna nie jest gwarantowana…”. |
| „Warunki promocji … krok po kroku” | `conditions[]` | `type` jedno z: `account_opening`, `card_payments`, `inflow`, `deadline`, `other`. Tytuł w trybie rozkazującym („Otwórz…”, „Zapłać…”), opis: szczegóły i wyjątki (limity, MCC, terminy wypłat). Bez zdania „Lista może zawierać także dodatkowe zasady…”. |
| „Dla kogo jest promocja?” | `eligibleFor`, `notEligibleFor`, `cooldownMonths` / `cooldownCutoffDate` | patrz sekcja 3. |
| „Opłaty za konto i kartę” | `fees` | patrz sekcja 2. |
| „Źródło i weryfikacja” | `sourceUrl`, `additionalSourceUrls`, `lastVerifiedAt` | `sourceUrl` = regulamin promocji. `additionalSourceUrls` = strona promocji + taryfa (min. 2). `lastVerifiedAt` = dzień, w którym przeczytałeś źródła. |
| Ściąga (krok po kroku w „Moim koncie”) | `checklistSteps[]` | patrz sekcja 4. |
| Przycisk „Przejdź do promocji” | `affiliateUrl` albo `ebrokerOid` | oid kampanii eBroker podaje link z katalogu; kampania tylko w Comperii: `affiliateUrl` = link partnerski Comperii. Zakaz promowania na blogach w kampanii: promocja `ACTIVE` z `adminOnly = true`, o tym w raporcie. |
| FAQ, dane strukturalne, ocena | generowane | nie wpisujesz. `rating` to wartość startowa (jak w poprzednich plikach, 7.0), nocny cron przelicza ocenę. `ratingOverride` i `ratingReason` należą do właściciela. |

`difficulty`: `EASY` (jedno-dwa proste kroki), `MEDIUM`, `HARD` (wiele miesięcy aktywności, progi wpływów, kredyt, terminal). To ocena, zaproponuj i opisz powód w raporcie.
`startDate` / `endDate`: ostatni dzień zapisów liczy się włącznie (Europe/Warsaw). Promocja „do wyczerpania puli” ma `endDate` = najpóźniejszy termin z regulaminu; pula jest w warunku `account_opening`, nie w dacie.

## 2. Opłaty: „Opłaty za konto i kartę” (najczęstsze źródło poprawek)
Strona pokazuje **dwa wiersze** („Opłata za konto”, „Opłata za kartę”): kwotę i pod nią „0 zł gdy <warunek>”. Nic więcej (bez bankomatów, bez „Inne opłaty”).
- **Kwota = stawka BEZ zwolnienia** z taryfy (np. 1500 = 15 zł). **0 zł z warunkiem zwolnienia jest zakazane** (kwota 0 oznacza bezwarunkowe 0 zł). Stawki nie znasz: `null` („Brak danych”), nigdy 0.
- **Warunek pisz jako dokończenie zdania „0 zł gdy …”**: małą literą, bez „0 zł” na początku. Dobrze: „w poprzednim miesiącu transakcje bezgotówkowe tą kartą wyniosły min. 700 zł”. Źle: „0 zł, gdy w poprzednim miesiącu…” (strona drukuje „0 zł gdy 0 zł, gdy…”). **Najwyżej 200 znaków**, jedno zdanie, bez dopisków w nawiasach o innych taryfach.
- **Zwolnienie z promocji** (np. „0 zł przez 3 lata od umowy”) wpisujesz do warunku razem z tym, co jest potem: „jesteś uczestnikiem promocji (przez 3 lata od umowy bez warunków), a potem wpływy na rachunek wynoszą min. 20 tys. zł w miesiącu albo średnie saldo min. 3 tys. zł”. Kwota to nadal stawka z taryfy po okresie promocyjnym.
- Bezwarunkowe zwolnienie tylko dla uczestników (np. „Karta Otwarta na Świat”): kwota z taryfy + „jesteś uczestnikiem promocji (bezterminowe zwolnienie z opłaty miesięcznej za …)”.
- **Bankomaty:** `atmFeeCents` zostaje puste, `otherFee` nie wspomina o bankomatach (decyzja z 22.08.2026).
- `otherFee`: krótka notatka dla właściciela (z jakiej taryfy, od kiedy, stawki bez zwolnienia). Strona jej nie drukuje.
- **`fees.sourceUrl` = taryfa albo dokument dotyczący opłat, nigdy regulamin promocji.** Najpierw publiczna taryfa; gdy jej brak, link afiliacyjny. Pole `null` dopiero po wyczerpaniu obu źródeł, z wpisem w raporcie.
- Opłaty uzupełniasz **zawsze**, dla konta i dla karty, także gdy promocja ich nie dotyczy.
- Wzorzec (BNP firmowe, po poprawce z 15.11.2026): konto `1500` + „jesteś uczestnikiem promocji (przez 3 lata od umowy bez warunków), a potem wpływy na rachunek wynoszą min. 20 tys. zł w miesiącu albo średnie saldo min. 3 tys. zł”; karta `900` + „jesteś uczestnikiem promocji (pierwsza karta przez 3 lata od umowy bez warunków), a potem transakcje bezgotówkowe tą kartą w poprzednim miesiącu wyniosły min. 700 zł”.

## 3. „Dla kogo jest promocja?”: każdą rzecz raz
Właściciel zauważył, że ta sama informacja stała na stronie w trzech miejscach.
- **Karencja** (data graniczna albo liczba miesięcy) siedzi **tylko** w `cooldownCutoffDate` / `cooldownMonths`. Strona sama składa z nich skrót w pasku faktów i jedno zdanie w „Dla kogo”. W `eligibleFor` i `notEligibleFor` nie ma dat ani „w ciągu ostatnich 24 miesięcy” (test sprawdza).
- `eligibleFor` mówi **KTO**: forma prawna, wiek, rodzaj klienta, kanał otwarcia konta. `notEligibleFor` mówi, kto **jeszcze** nie może albo czego promocja nie obejmuje (wyłączenia, łączenie z innymi promocjami, jeden udział): **nie jest lustrem** „kto może” czytanego od końca.
- Okno karencji z końcem (np. „01.07.2025–30.06.2026”) nie ma pola na koniec: nie wpisuj go do `eligibleFor`; opisz w raporcie.
- Konto dla osób młodych (limit wieku) ma `accountType: YOUNG` albo jest osobiste z limitem wieku: **na stronie głównej takich ofert nie pokazujemy** (`HOME_HIDDEN_*` w `src/components/home/homeModel.ts`); dopisz je tam albo zgłoś w raporcie.
- Zakazane zdania (w żadnym polu): „Lista może zawierać także dodatkowe zasady i ograniczenia, a nie tylko czynności do wykonania.” i „Premia maksymalna nie jest gwarantowana – otrzymasz ją tylko po spełnieniu wszystkich warunków cząstkowych opisanych wyżej.” (`offerCopyRules.ts`).

## 4. Ściąga (`checklistSteps`)
- Grupa 0: **„Otwarcie konta”** (kroki od dnia umowy, bez terminu). Dalej grupy **„Miesiąc 1 (po otwarciu konta)”, „Miesiąc 2” …**
- **Najwyżej jedna nagroda (`rewardCents`) w grupie** (aplikacja liczy tylko pierwszą). Suma nagród = `maxBonusCents`. Nagroda ma własny krok („Odbierz …”) po krokach do zrobienia.
- Kroki to czynności („Zapłać kartą …”, „Zaloguj się do aplikacji …”), z limitami i terminami z regulaminu. Okno krótkie (7, 10, 14, 30 dni) zostaje w grupie 0; grupy nie-miesięczne przesuwają harmonogram, więc nie mieszaj ich z „Miesiąc N”, jeśli nie musisz.
- `order` unikalny; reszta w `data/candidates/_src/lib.py` (`open_steps`, `month_steps`). Generator `gen_*.py` + plik wynikowy trafiają do repozytorium (osobna gałąź, jawna lista plików, nigdy katalog).

## 5. Lista kontrolna przed zapisem (dry-run musi być zielony)
1. Każda liczba i data ma źródło, które otworzyłeś (regulamin, strona promocji, taryfa); linki w polach prowadzą do tego, na co wskazują.
2. `maxBonusCents` = suma `bonusParts` = suma nagród w ściądze; jedna nagroda w grupie.
3. Opłaty konto i karta uzupełnione wg sekcji 2; żadnego „0 zł” na początku warunku; ≤ 200 znaków; bez bankomatów.
4. `summary` ≤ 160 znaków; „Dla kogo” bez dat i bez lustra; brak zakazanych zdań.
5. `sourceUrl` = regulamin, `additionalSourceUrls` = strona promocji i taryfa, `lastVerifiedAt` = dziś.
6. `endDate` = ostatni dzień zapisów (włącznie); nowa edycja = nowy slug.
7. `npx.cmd tsx scripts/add-promotion-with-checklist.ts <plik>` (dry-run) bez błędów, dopiero potem `--apply`. `npm test` zawiera `tests/promotion-pattern.test.ts`, który sprawdza nowe pliki (`lastVerifiedAt` od 15.11.2026).
8. W raporcie: dodana promocja (slug, kwota, daty, DRAFT/ACTIVE, źródła), czego nie udało się potwierdzić, i wszystko, co wymaga decyzji właściciela.

Historia zmian: 15.11.2026: pierwsza wersja, po poprawce opłat w dwóch promocjach BNP Paribas (Podróżnik ed. 4 i Rozpędź swój biznes ed. 4).
