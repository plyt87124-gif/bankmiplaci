# Etap 1 — kolejność wdrożenia, zgodność wersji, wycofanie, korekty danych

Stan: przygotowane do oceny. **Nic z poniższego nie zostało wykonane na produkcji** — ani migracje, ani korekty danych, ani wdrożenie aplikacji, ani merge do `main`.
Branch: `fix/etap1-claude-code-poprawki`. Weryfikacja treści Erste: `docs/etap1-weryfikacja-erste.md`.

## 1. Kolejność (obowiązkowa)

| Krok | Co | Kto/jak | Dlaczego w tym miejscu |
|---|---|---|---|
| 0 | Kopia bazy (snapshot/branch w Neon) | właściciel | punkt powrotu dla całości |
| 1 | **Migracje schematu** (5 szt.) | `npm run prisma:deploy` z produkcyjnym `DATABASE_URL` | nowa aplikacja czyta nowe kolumny; bez nich każde zapytanie o promocję zwróciłoby błąd 500 |
| 2 | **Wdrożenie aplikacji** (merge brancha → Vercel) | właściciel | dopiero ta wersja rozumie `availableUntil`, `affiliateLinkEnabled`, warunki zwolnienia z opłat i regułę „ostatni dzień” |
| 3 | Sprawdzenie po wdrożeniu (sekcja 5) | | zanim ruszą się dane |
| 4 | **Korekty danych**: najpierw mBank, potem Erste — dry-run → przegląd → `--apply --plan` | `scripts/data-corrections/*.js` | stara aplikacja nie zna nowych kolumn |
| 5 | `npm run audit:fees` na produkcji | | lista rekordów z opłatami do weryfikacji (nic nie jest zmieniane) |
| 6 | Włączenie linku partnerskiego Erste | właściciel, w adminie („Link partnerski aktywny”) po potwierdzeniu kampanii w eBrokerPartner | patrz sekcja 7 |

Kroków 1 i 2 nie wolno zamienić miejscami. Kroku 4 nie wolno wykonać przed 2. Plik `plan-*.json` z dry-runu musi powstać **po** kroku 2
(dry-run sprzed migracji ma inne wartości „przed” — `--apply` odmówi z komunikatem, że dane zmieniły się od dry-runu).

Blok `git.deploymentEnabled` w `vercel.json` zostaje: dotyczy wyłącznie gałęzi `fix/etap1-claude-code-poprawki` (klucz = nazwa gałęzi), więc **nie blokuje `main`**
ani żadnej innej gałęzi — wdrożenie produkcyjne po merge'u do `main` działa jak dotąd. Nie należy włączać dla tej gałęzi podglądu Vercel (patrz sekcja 6).

## 2. Migracje

Wszystkie pięć jest **addytywnych albo rozluźniających** — nie usuwają ani nie przepisują danych. Sprawdzone: pełna historia (23 migracje) aplikuje się na pustej bazie,
a `prisma migrate diff --from-migrations … --to-schema-datamodel …` zwraca „No difference detected” (lokalnie i w CI).

| Plik | Skutek |
|---|---|
| `20261001185523_fees_nullable_and_waiver_conditions` | `fees`: +`accountFeeWaiverCondition`, +`cardFeeWaiverCondition` (TEXT NULL); `accountFeeCents`, `cardFeeCents`, `atmFeeCents`: `DROP NOT NULL`, `DROP DEFAULT`. Istniejące wartości (w tym 0) bez zmian — migracja **nie** uznaje ich za „potwierdzone”. |
| `20261001190152_article_content_updated_at` | `articles`: +`contentUpdatedAt` (TIMESTAMP NULL) |
| `20261001194006_promotion_content_updated_at` | `promotions`: +`contentUpdatedAt` (TIMESTAMP NULL) |
| `20261002102019_bonus_part_available_until` | `bonus_parts`: +`availableUntil` (TIMESTAMP NULL) |
| `20261002161350_checklist_availability_and_affiliate_flag` | `checklist_steps`: +`availableUntil` (TIMESTAMP NULL); `promotions`: +`affiliateLinkEnabled` (BOOLEAN **NOT NULL DEFAULT true**) |

Wszystkie to operacje wyłącznie na metadanych (krótka blokada tabeli). Domyślne `true` oznacza, że każda istniejąca promocja zachowuje dotychczasowe działanie linku.

## 3. Zgodność ze STARĄ wersją aplikacji — wynik pomiaru, nie założenie

Samo pozostawienie nowych kolumn nie dowodzi zgodności, więc stary kod (`main`, `2801600`) zbudowano w osobnym worktree i uruchomiono
(`next dev`, port 3200) na tej samej lokalnej bazie po migracjach, z danymi zapisanymi tak, jak zapisuje je nowa wersja:

| Sytuacja w bazie | Stara aplikacja |
|---|---|
| Nowe kolumny istnieją, wartości zwykłe (opłata karty 900 + warunek, `availableUntil`, `affiliateLinkEnabled=false`) | **działa** — strona promocji 200, `/sitemap.xml` 200 |
| **Wiersz `fees` z NULL w `accountFeeCents`/`cardFeeCents`/`atmFeeCents`** | **HTTP 500** na `/`, `/promocje`, `/porownaj`, `/api/promotions/active` i na stronie tej promocji. Błąd Prisma: `Error converting field "accountFeeCents" of expected non-nullable type "Int", found incompatible value of "null"`. Wystarczy **jedna** taka promocja na liście. |
| ACTIVE + `affiliateLinkEnabled=false` | stara aplikacja nie zna flagi; jej `/out/<slug>` przekierowuje do partnera (i **nigdy** nie sprawdzała statusu ani daty — to wada naprawiona w `b97b96b`, dotyczy każdej nieaktywnej oferty) |

Wniosek: **NULL w opłatach pojawi się dopiero po zapisach nowej wersji** (puste pole w adminie, nowa promocja bez opłat, import). Od tej chwili powrót do starej wersji
bez przygotowania danych wyłączyłby stronę główną. Kroki 1–2 są bezpieczne dla starej wersji tylko dopóki nie zapisano żadnego NULL.
Sprawdzenie: `select count(*) from fees where "accountFeeCents" is null or "cardFeeCents" is null or "atmFeeCents" is null;`

## 4. Procedura wycofania

**Preferowane: poprawka w przód** (nowa wersja jest zgodna z danymi; stara nie jest). Jeśli jednak trzeba wrócić do starej aplikacji:

1. Wstrzymaj zapisy w adminie / importy (nowe NULL-e).
2. `node scripts/data-corrections/old-app-rollback.js` — dry-run: lista wierszy `fees` z NULL (→ 0, jedyne, co rozumie stary kod; stara aplikacja pokaże „0 zł” —
   znane, dawne zachowanie) oraz promocji z `affiliateLinkEnabled=false` (→ `affiliateUrl` ustawiony na własną stronę oferty, ACTIVE → EXPIRED).
   Dopiero po przeglądzie: `--apply --plan <plik>` (transakcja, compare-and-set, plik `revert-old-app-rollback-*.json`).
3. Wdróż starą wersję aplikacji (Vercel: poprzednie wdrożenie).
4. Sprawdź: `/`, `/promocje`, `/porownaj`, `/api/promotions/active` → 200; `/out/<slug-oferty-bez-linku>` → trafia na własną stronę oferty, nie do partnera.
5. Powrót do nowej wersji: najpierw wdróż nową aplikację, **potem** `--revert revert-old-app-rollback-*.json` (przywraca NULL-e i adresy; odmówi, jeśli wiersz zmieniono w międzyczasie).
6. Cofnięcie samych korekt danych mBank/Erste: `--revert revert-…json` odpowiedniego skryptu (z zabezpieczeniem przed nadpisaniem późniejszych edycji).

Procedurę przećwiczono lokalnie na stanie z pomiaru powyżej: po kroku 2 stara aplikacja zwraca 200 na wszystkich czterech trasach, `/out/` dla oferty bez linku
przekierowuje na własną stronę, a `--revert` przywraca NULL-e, status i adres (jest też w `selftest.js`: transakcja, compare-and-set, enum, odtwarzanie).

Ograniczenia, które zostają przy powrocie do starej wersji: (a) `/out/` dla ofert **bez** flagi (EXPIRED/DRAFT/ARCHIVED) znów przekierowuje do partnera — to wada starej wersji;
(b) zakończone części bonusu (Kantor) i warunki zwolnienia z opłaty nie są rozumiane (stary kod wlicza Kantor do sumy); (c) ściąga wraca do pokazywania wszystkim wszystkich kroków.
Dlatego migracji **nie cofa się** (nowe kolumny zostają, są nieszkodliwe), a wycofanie dotyczy aplikacji i danych.

## 5. Sprawdzenie po wdrożeniu aplikacji (krok 3)

```bash
curl -sI https://bankmiplaci.pl/jak-to-dziala | head -1                 # 200
curl -s  https://bankmiplaci.pl/sitemap.xml | grep -c "<loc>"            # /jak-to-dziala obecne
curl -s  https://bankmiplaci.pl/sitemap.xml | grep -c "<lastmod>"        # tylko strony ze znaną datą zmiany treści
curl -sI https://bankmiplaci.pl/out/<slug-nieaktywnej> | grep -i -E "^(HTTP|location)"   # 307 -> /promocje?niedostepna=1
curl -s  https://bankmiplaci.pl/promocje/<slug> | grep -o '<meta name="robots"[^>]*>'
```

## 6. Linux, CI i wypchnięcie brancha

* Repozytorium jest **publiczne** (`github.com/plyt87124-gif/bankmiplaci`): wypchnięty branch jest widoczny dla każdego. Zawartość przejrzano pod kątem sekretów — brak
  (`.env*`, pliki `plan-*`/`revert-*` są w `.gitignore`; w dokumentach jest nazwa partnera eBrokerPartner, bez żadnych linków/identyfikatorów kampanii).
* **Vercel**: `DATABASE_URL` jest ustawiony dla środowisk Development, Preview **i Production** (ta sama wartość) — gdyby push uruchomił podgląd Vercel,
  łączyłby się z bazą produkcyjną (której schemat nie ma nowych kolumn → build by się wysypał, a działający podgląd mógłby zapisywać statystyki do produkcji).
  Dlatego `vercel.json` wyłącza automatyczne wdrożenia dla tego jednego brancha (`git.deploymentEnabled`; klucz to nazwa gałęzi, więc `main` i inne gałęzie nie są dotknięte),
  a po pushu sprawdzono, że wdrożenie nie powstało. Blok może zostać po merge'u — jest nieszkodliwy; Preview korzystający z bazy produkcyjnej nie powinien być uruchamiany.
  Podgląd Vercel z osobną bazą wymagałby dodania zmiennej `DATABASE_URL` w zakresie Preview — zmiana w koncie Vercel, której nie robiłem.
* **GitHub Actions** (`.github/workflows/ci.yml`, uruchamiany tylko dla `fix/**` i PR): Ubuntu, Node 24 (jak w projekcie Vercel), kontener Postgres 16 tworzony na czas przebiegu,
  bez sekretów repozytorium: `npm ci` → pilnuje, że `scripts.build === "next build"` (shim Windows nigdy nie trafia do zwykłego builda) → `prisma migrate deploy` na pustej bazie →
  `migrate diff` (migracje = schema.prisma) → `tsc` → `npm test` → **`npm run test:db`** (testy na prawdziwej bazie, sekcja 10) → self-test korekt → seed fixtur → **zwykły** `npm run build` → test HTTP zbudowanej aplikacji
  (w tym `/opengraph-image` → 200 `image/png`, czego nie da się sprawdzić na Windowsie). Wersje zależności nie zostały zmienione.
* Windowsowy shim jest wyłącznie w `npm run build:win` (`scripts/build-win.cjs`); `npm run build` jest niezmienione.

## 7. Korekty danych — `scripts/data-corrections/`

Pobranie adresu bazy: `npx vercel env pull .env.production.check --environment=production --yes` (plik w `.gitignore`; usuń po użyciu).

```bash
node scripts/data-corrections/mbank-card-fee.js                              # dry-run (domyślnie) + plan-*.json
node scripts/data-corrections/erste-platinum.js                              # dry-run + plan-*.json
node scripts/data-corrections/mbank-card-fee.js   --apply --plan <plan>      # po akceptacji
node scripts/data-corrections/erste-platinum.js   --apply --groups=dane,widocznosc --plan <plan>
node scripts/data-corrections/<skrypt>.js --revert revert-<nazwa>-<czas>.json [--force]
node scripts/data-corrections/selftest.js                                    # test mechanizmu na LOKALNEJ bazie
```

Zabezpieczenia (`lib.js`, sprawdzone przez `selftest.js` i CI):

* **Identyfikacja** po slugach / id wierszy, zero wzorców.
* **Związanie z przejrzanym dry-runem** — `--apply` wymaga `--plan <plik>` i **przerywa**, jeśli odczytane teraz dane różnią się od tych w planie (stan „przed” albo zapisywane wartości).
* **Jedna transakcja** — wszystkie zmiany albo żadna.
* **Compare-and-set** — każdy `UPDATE` ma `WHERE kolumna IS NOT DISTINCT FROM <wartość z planu>`; jeśli ktoś zmienił pole (admin, import), transakcja się wycofuje.
  Przeliczenie rankingu zmienia tylko `rating`/`updatedAt`, więc nie blokuje.
* **Odtworzenie** — `--apply` najpierw zapisuje `revert-*.json`; `--revert` przywraca wartości, ale odmawia, jeśli wiersz zmieniono po korekcie (chyba że `--force`).
* `--apply` **odmawia**, jeśli w bazie brakuje wymaganej kolumny (migracje niewdrożone).
* Test na lokalnej bazie wykrył dwa błędy w samym narzędziu, już naprawione: porównanie dat zależne od strefy sesji Postgresa oraz brak rzutowania kolumn enum (`status`).
* `lastVerifiedAt` **nie jest ruszane** żadną korektą — sprawdzono daty, nagrody i opłaty, nie całą ofertę.
* Bez zmian: slug, powiązania użytkowników, `UserPromotionTracking`, id/kolejność/postęp kroków ściągi, `affiliateUrl`.

**Erste — dwie niezależne grupy** (`--groups=`, brak domyślnej): `dane` (teksty, daty, kwoty, opłaty, artykuł, terminy zapisów Kantoru w częściach bonusu i krokach ściągi) oraz
`widocznosc` (status EXPIRED → ACTIVE **razem z** `affiliateLinkEnabled=false`: oferta bankowa jest widoczna, ale bez przycisku i bez przekierowania partnerskiego).
Skrypt nigdy nie włącza linku partnerskiego.

## 8. Co zmieniono w ściądze (Erste) i jak działa dla trzech uczestników

Dostępność kroku zależy od **rzeczywistej daty otwarcia konta** (`UserPromotionTracking.accountOpenedAt`, podawanej przy dołączaniu do ściągi) — nigdy od `joinedAt`
(kiedy użytkownik założył ściągę u nas). Wiersze, id, kolejność i zapisany postęp nie są zmieniane — zmienia się wyłącznie sposób ich odczytu (`src/lib/checklistAvailability.ts`):

| Uczestnik | Krok Kantoru (wymiana) | Nagroda Kantoru 300 zł | Reszta ściągi |
|---|---|---|---|
| konto otwarte do 30.09.2026 włącznie | widoczny, wymagany | liczona po ukończeniu grupy | bez zmian |
| konto otwarte po 30.09.2026 | **ukryty**, nie można go odhaczyć (API → 400), zapisany wcześniej „stary” znacznik jest zachowany w bazie, ale niewliczany | **ukryta** | miesiąc kończy się bez Kantoru |
| brak daty otwarcia konta | widoczny jako **opcjonalny** z opisem, poza „zaznacz cały miesiąc”, nie wymagany | liczona **tylko** po jawnym odhaczeniu kroku Kantoru; nigdy automatycznie | bez zmian |

Przetestowane: 7 testów jednostkowych (`tests/checklist.test.ts`) oraz w przeglądarce na lokalnej bazie z trzema kontami (przed terminem / po terminie / bez daty), wraz z wywołaniami `/api/checklist/toggle`.

## 9. Blokery i decyzje właściciela

1. **Włączenie linku partnerskiego Erste** — po potwierdzeniu kampanii w panelu eBrokerPartner (checkbox „Link partnerski aktywny” w adminie). Sam regulamin banku tego nie rozstrzyga.
2. **Uczestnicy ściągi bez `accountOpenedAt`** (starsze zapisy sprzed wymogu daty) mogą ją sami uzupełnić w „Moje konto” (sekcja 11b; jednorazowo, bez nadpisywania, bez zmiany odhaczeń). Do czasu uzupełnienia ich Kantor pozostaje opcjonalny. Nikomu nie ustawiamy daty za niego — to dane od użytkownika.
3. **Starsze rekordy bez `contentUpdatedAt`** nie mają `<lastmod>` w mapie witryny (celowo — nie ma wiarygodnej daty); pojawi się po pierwszej realnej edycji.
4. **Pozostałe artykuły** i oferty nie były audytowane pod kątem faktów (poza opisanymi w `etap1-weryfikacja-erste.md`).
5. **Historyczny canonical Millennium (obca domena)** — przyczyna **nieustalona**; aktualny test GSC i kod są poprawne. Do sprawdzenia po ponownym skanowaniu (14/28 dni).
6. **Lint** — w repozytorium nie ma konfiguracji ESLint (`next lint` pyta interaktywnie); nie dodawałem jej bez Twojej decyzji.
7. **Zgłoszenia map w GSC** (cztery błędne) — czynność administracyjna w Google, poza kodem.
8. Gdyby Vercel mimo wszystko utworzył podgląd tego brancha (np. po zmianie nazwy brancha) — nie odwiedzać go: łączy się z bazą produkcyjną.

## 10. Poprawki po przeglądzie: czyszczenie opłat, import terminów nagród, daty aktualizacji

Wszystkie trzy błędy to ta sama klasa: **`undefined` w Prisma oznacza „nie ruszaj”**, a nie „wyczyść”, więc kod, który porównuje lub zapisuje surowe dane wejściowe,
rozjeżdża się z tym, co faktycznie ląduje w bazie. Testy poniżej działają na prawdziwej bazie (`npm run test:db`, w CI na kontenerze Postgres) i przechodzą przez te same
funkcje co panel admina i import (`src/lib/services/promotionWrite.ts`, `promotionImport.ts`, `src/lib/promotionForm.ts`). Każdy z nich został zweryfikowany mutacją:
po przywróceniu starego zachowania odpowiedni test pada.

| # | Błąd | Naprawa | Testy (`tests/db/…`, `tests/*.test.ts`) |
|---|---|---|---|
| 1 | Wyczyszczone pole opłaty szło do `upsert.update` jako `undefined` → stara kwota zostawała | Puste pole → jawny `null` (`optionalFeeCents`, `feesWriteData`); wpisane `0` zostaje `0`; puste pola tekstowe (warunek zwolnienia, uwagi) → `null`; `fees.sourceUrl` poza formularzem, więc zostaje | `fees-clear`: każda z trzech kwot osobno (wyczyszczenie → `NULL`, pozostałe bez zmian, strona = „Nieustalone”), wpisanie `0` → `0`, wszystkie trzy naraz → ponowne wpisanie → `0`, mieszane (`NULL`/0/750), czyszczenie tekstów, rekord bez wiersza `fees`; `fees.test`: schemat i `feesWriteData`; `ci-smoke`: strona z `NULL` mówi „Nieustalone” (≥3 razy), bez „0 zł*” |
| 2 | Import kasował i odtwarzał `bonus_parts` bez `availableUntil` → termin znikał, nagroda znów otwarta dla nowych | `resolveBonusParts`: pominięte pole = dziedziczenie przy jednoznacznym dopasowaniu etykiety (dokładnie 1 zapisana i 1 w pliku); `null` = jawne usunięcie; data = ustawienie. Niejednoznaczność przy zapisanym terminie, brak zapisanej części z terminem w pliku, nieprawidłowa data (także 31 lutego) → `ImportAbortError` **przed jakąkolwiek zmianą**. Planowanie wszystkich wpisów (tylko odczyt) i zapis są w jednej transakcji | `import-availability`: ponowny import bez pola → termin 30.09 zostaje, 02.10 zamknięta dla nowych, 30.09 20:00 jeszcze otwarta; `null`/data jawnie; niejednoznaczność i brakująca część → stan bazy identyczny przed/po (nawet podsumowanie tego samego wpisu); błędny wpis nr 2 → wpis nr 1 **nie** zastosowany; awaria w fazie zapisu → rollback całości; `import.test`: 6 przypadków reguł (etykiety, `null` vs pominięcie, niejednoznaczność, daty) |
| 3 | Migawka treści porównywała surowe dane (z `additionalSourceUrls`, `fees.sourceUrl`, `description` itd. brakującymi w formularzu/imporcie) ze stanem w bazie → każdy zapis wyglądał na zmianę | Porównanie **stanu zapisanego z efektywnym stanem po zapisie**: zapisany stan nałożony tylko na klucze, które Prisma naprawdę ustawi (`overlayDefined`); ten sam obiekt służy do zapisu i do porównania | `content-dates`: dwa kolejne zapisy bez edycji rekordu z dodatkowymi źródłami, `fees.sourceUrl`, opisem, warunkiem zwolnienia i terminem Kantoru → `contentUpdatedAt` pozostaje `NULL`, wszystko zachowane; identyczny import → bez zmiany (`contentChanged = 0`); prawdziwa zmiana (formularz i import) → przesuwa; zapis bez edycji po zmianie → nie przesuwa ponownie; wykrywane zmiany: wyczyszczona opłata, kwota, warunek zwolnienia, tekst warunku |

### 10a. Dopełnienie: „Źródło warunków”, „Okres karencji”, „Data graniczna”

To samo `undefined` → pominięcie dotyczyło trzech pól formularza admina (puste pole zostawiało starą wartość). Teraz:

* **puste pole formularza → jawny `null` → w bazie `NULL`** (`sourceUrl`: pusty lub same spacje; `cooldownMonths`: puste pole liczbowe = `NaN` z `valueAsNumber`; `cooldownCutoffDate`: pusta data). Schemat: `src/lib/validation/promotion.ts`, zapis: `promotionFormScalars` w `promotionWrite.ts`.
* **wpisane `0` miesięcy zostaje `0`** (`0` ≠ puste; `0` i `NULL` to różna treść, więc przejście między nimi przesuwa `contentUpdatedAt`).
* **brak klucza w danych** (czego formularz nigdy nie wysyła) nadal znaczy „nie ruszaj” — wartość zostaje.
* `additionalSourceUrls` i `fees.sourceUrl` nie są częścią formularza i nigdy nie są dotykane.
* **Import bez zmian:** pole pominięte w pliku (lub `null`) zachowuje zapisaną wartość, tak jak przedtem; plik nie „odtwarza” wartości wyczyszczonej w adminie.
* `zod`: `z.coerce.date()` zamieniłby `null` na 1970-01-01, ale `nullable()` obsługuje `null` wcześniej — test „Data graniczna” sprawdza, że w bazie ląduje `NULL`.

Testy `tests/db/source-cooldown-clear.test.ts` (17): odczyt istniejących wartości do formularza i zapis bez edycji; wyczyszczenie każdego pola osobno (pozostałe dwa, dodatkowe źródła i `fees.sourceUrl` bez zmian); same spacje w URL; wszystkie trzy naraz → ponowne wpisanie; `0` → `0` przez zapis bez edycji, `0` → puste → `0`; `NULL` ↔ `0`; po wyczyszczeniu kolejne zapisy bez edycji i ponowne czyszczenie pustych pól nie przesuwają `contentUpdatedAt`; dwa kolejne zapisy rekordu z wypełnionymi polami i rekordu bez nich; brak kluczy ≠ wyczyszczenie; błędny URL odrzucony; import z pominiętymi polami / z tymi samymi wartościami / po wyczyszczeniu w adminie. Mutacja: ze starym kodem `src` 9 z 17 pada (wszystkie przypadki czyszczenia). Sprawdzone też ręcznie w prawdziwym formularzu (lokalna baza): wyczyszczenie trzech pól → `NULL` ×3, `0` → `0`, zapis bez edycji nie rusza `contentUpdatedAt`.

Wciąż poza zakresem, zauważone: pola tekstowe „Promocja dla”, „Kto nie może skorzystać”, „Podsumowanie” po wyczyszczeniu zapisują pusty ciąg `""`, a nie `NULL` (treść jest porównywana jako pusta, więc nie powoduje fałszywych zmian dat). Reguła `computeEligibility` traktuje `cooldownMonths = 0` jak brak reguły („nieznane”) — zachowanie bez zmian.

## 11. Zerowa karencja i uzupełnianie daty otwarcia konta w „Moje konto”

### 11a. `cooldownMonths = 0` (jedna reguła na stronie, w ściądze i w powiadomieniach)

Znaczenie danych: **`0` = reguła miesięczna bez dodatkowego oczekiwania** (kwalifikacja od znanej daty zamknięcia konta), **`NULL` = brak reguły miesięcznej**. Wcześniej strona traktowała `0` jak brak reguły (`!cooldownMonths` → „nieznane”, a ściąga zostawała zablokowana na zawsze), a powiadomienia liczyły `0` jako zerowe oczekiwanie — dwie różne odpowiedzi. Teraz jedna funkcja, `computeEligibility` (`src/lib/services/eligibility.ts`), jest używana przez: baner na stronie promocji, blokadę ponownego dołączenia do ściągi (`isChecklistRestartLocked`, także po stronie serwera w `POST /api/checklist/join`) i powiadomienia „karencja minęła” (`eligibilityNotifications.ts`).

| Dane | Wynik |
|---|---|
| brak reguł (`NULL` i brak daty granicznej) | nieznane — nic nie zakładamy, także gdy użytkownik ma datę zamknięcia |
| brak daty zamknięcia konta w historii użytkownika | nieznane (dla każdej reguły) — kwalifikacja nie jest zakładana |
| `0` + data zamknięcia w przeszłości lub dziś | kwalifikuje się od tej daty |
| data zamknięcia w przyszłości | nie kwalifikuje się do tego dnia (konto nie jest jeszcze zamknięte), nawet przy samej dacie granicznej |
| `0` + data graniczna spełniona (zamknięcie **przed** nią) | kwalifikuje się |
| `0` + data graniczna niespełniona (zamknięcie w dniu granicznym lub później) | nie, `cutoffFailed` — niezależnie od upływu czasu |
| `N > 0` | jak dotąd: zamknięcie + N miesięcy (miesiące kalendarzowe UTC) |

Dni porównywane są jako dni kalendarzowe w Polsce (ten sam zegar co termin zapisu): data zamknięcia „dzisiaj” jest już przeszłością także tuż po północy czasu polskiego.

Powiadomienia: decyzja per promocja (aktywna, przed terminem, z regułą miesięczną, `0` wliczone), a nie „najniższe N z banku”. Użytkownik jest powiadamiany i linkowany tylko do promocji, którą naprawdę spełnia (z datą graniczną); najlepiej oceniona **z tych spełnianych**. Wiersz z datą zamknięcia w przyszłości nie jest oznaczany jako powiadomiony, więc zostanie wzięty w dniu zamknięcia. `checkEligibilityAndNotify` przyjmuje opcjonalnie `client`, `send`, `now`, `userIds` (domyślnie jak cron: baza, `sendEmail`, teraz, wszyscy), dzięki czemu testy nie wysyłają żadnych e-maili.

Zmiana zachowania do świadomej oceny: dla promocji z `cooldownMonths = 0` każdy użytkownik, który poda datę zamknięcia konta w tym banku, dostanie następnego dnia powiadomienie (tak było już przed zmianą w powiadomieniach; teraz strona i ściąga mówią to samo). Nowe: `POST /api/checklist/join` odmawia (409) ponownego startu ukończonej ściągi, gdy ta sama reguła mówi „zablokowana” — wcześniej blokada była tylko w interfejsie.

Testy: `tests/eligibility.test.ts` (18, hermetyczne: 0 ze znaną datą / dziś / tuż po północy w Polsce, `NULL` bez reguły, brak historii, przyszła data zamknięcia, `0` z zaliczoną i niezaliczoną datą graniczną, granica dnia granicznego, blokada ściągi), `tests/db/eligibility-notify.test.ts` (11, z podstawionym nadawcą — żadnych e-maili), `tests/db/checklist-restart.test.ts` (9: trasa dołączania i strona dają tę samą odpowiedź w każdym przypadku). Mutacje: `0` traktowane jak `NULL` → 11 testów pada; pominięta data graniczna → 6 pada.

### 11b. Data otwarcia konta dla starszych ściąg

Starsze, nieukończone ściągi nie mają `accountOpenedAt`, więc nie wiadomo, które miesiące są dostępne i czy obowiązują terminy części (Kantor). W „Moje konto” na karcie takiej ściągi jest pole „Podaj datę otwarcia konta” (`POST /api/checklist/opened-at`, logika w `setAccountOpenedAt`, `src/lib/services/checklistTracking.ts`):

* zapisywana jest **tylko** kolumna `accountOpenedAt` (00:00 UTC wybranego dnia, jak w „join”); `id`, `joinedAt`, `remindedGroupIndexes` i wszystkie odhaczenia (`ChecklistProgress`) zostają bez zmian. Dostępność miesięcy, kroków Kantora i nagród nie jest nigdzie zapisana — jest wyliczana z `accountOpenedAt` przy każdym odczycie (istniejące reguły), więc przelicza się sama;
* odrzucane: format inny niż `RRRR-MM-DD`, nieistniejące dni (31 lutego), data późniejsza niż dziś w Polsce, data przed 2000-01-01 (literówki typu `0026`);
* zapis jednym `UPDATE … WHERE id AND userId AND completedAt IS NULL AND accountOpenedAt IS NULL`: cudza ściąga i nieistniejące id dają identyczne 404 (bez zgadywania id), data już zapisana i ściąga ukończona dają 409 — **zapisanej daty nie można nadpisać** (bramkuje miesiące i nagrody), a dwa równoczesne zapisy kończą się jednym zwycięzcą;
* data **po** terminie Kantora (≥ 01.10.2026): krok i nagroda Kantora znikają z widoku i z sumy, ale zapisane odhaczenie zostaje w bazie; data **do** terminu (≤ 30.09.2026): Kantor wymagany, nagroda liczona po jego odhaczeniu. Bez daty nagroda z terminem liczy się wyłącznie, gdy użytkownik sam odhaczył krok Kantora (istniejąca reguła „nieznana data”).

Testy: `tests/db/tracking-opened-at.test.ts` (data przed / po / dokładnie w dniu terminu, zachowanie id, `joinedAt`, odhaczeń i `remindedGroupIndexes`, otwieranie miesięcy według zapisanej daty, odrzucenie dat przyszłych / nieprawidłowych bez zapisu, cudza ściąga, brak nadpisania, ściąga z datą z „join”, ukończona, wyścig). Mutacja: bez filtrów właściciel / `accountOpenedAt IS NULL` / `completedAt IS NULL` → 5 testów pada. Sprawdzone ręcznie w prawdziwej stronie „Moje konto” (lokalna baza): data z przyszłości odrzucona komunikatem, data 01.10.2026 zapisana, Kantor i jego nagroda zniknęły (500 zł → 200 zł), odhaczenia i `joinedAt` bez zmian.

### 11c. `/api/checklist/join` zgodny z `/opened-at`

Po przeglądzie `39ed64b` dwa błędy w `/join`: (1) `new Date(...)` + porównanie z `Date.now()` przyjmowało nieistniejące `2026-02-31` i odrzucało poprawną dzisiejszą datę tuż po północy w Polsce (UTC bywa wtedy jeszcze „wczoraj”); (2) `upsert.update: { accountOpenedAt }` pozwalał ponowionym żądaniem nadpisać zapisaną datę mimo komunikatu „Datę można zapisać tylko raz”.

Logika jest teraz w `joinChecklist` (`src/lib/services/checklistTracking.ts`), a trasa to cienka nakładka:

* data przez to samo `parseAccountOpenedAt` co `/opened-at` (tylko `RRRR-MM-DD`, istniejący dzień, nie później niż dziś w Europe/Warsaw, nie przed 2000-01-01);
* brak ściągi → `INSERT` (równoczesny duplikat trafia w klucz unikalny i jest traktowany jak „ściąga już istnieje”);
* nieukończona, **bez** daty → `UPDATE … WHERE accountOpenedAt IS NULL AND completedAt IS NULL` (atomowo, jak `/opened-at`);
* nieukończona, data już zapisana → **ta sama data = sukces bez zmian (idempotentnie)**, inna data = 409 „Data otwarcia konta jest już zapisana…”; odhaczenia, `joinedAt`, `id` nietknięte;
* ukończona → blokada karencji jak dotąd (409), a gdy dozwolone: restart w jednej transakcji `UPDATE … WHERE completedAt IS NOT NULL` (+ usunięcie odhaczeń tej promocji) **ustawia datę nowego cyklu**; równoczesny drugi restart nie wykona się drugi raz;
* `JoinChecklistButton`: wartość początkowa i `max` pola daty według dnia w Europe/Warsaw (nie UTC); błąd z serwera jest wyświetlany pod przyciskiem (wcześniej odmowa była niema).

Testy `tests/db/checklist-join.test.ts` (17, prawdziwa baza, ścieżką zapisu `/join`): utworzenie z datą 00:00 UTC; `2026-02-31` i inne daty nieprawidłowe / przyszłe → 400 bez śladu w bazie; dzisiejsza data o 00:30 w Polsce przyjęta, jutrzejsza nie; ponowione żądanie z **inną** datą → 409, wiersz i wszystkie odhaczenia (wraz z `checkedAt`) identyczne; ta sama data → `unchanged`; uzupełnienie pustej daty starszej ściągi z zachowaniem odhaczeń; trzy rodzaje równoczesności (pierwsze dołączenie z różnymi datami: jeden zwycięzca; z taką samą: wszystkie sukces, jeden wiersz; uzupełnianie pustej daty czterema datami: jeden zwycięzca, nieprzepisywalny); restart ukończonej ściągi ustawia nową datę, czyści tylko odhaczenia tej promocji, jest chroniony jak zwykła data; pięć wariantów blokady → 409 bez zmian; data restartu walidowana; równoczesne restarty → jeden restart. Uruchomione na portacie dawnej logiki trasy: 13 z 17 pada (m.in. 31 lutego, północ w Polsce, nadpisanie daty, równoczesne zapisy, walidacja daty restartu).

### 11d. Reset przypomnień przy restarcie ukończonej ściągi

`UserPromotionTracking.remindedGroupIndexes` to znaczniki „przypomnienie o miesiącu X już wysłane” (dedup w `checklistReminders`). Restart ukończonej ściągi zostawiał je z poprzedniego cyklu, więc nowy cykl nie dostawał przypomnień o tych samych miesiącach. Teraz **wyłącznie** dozwolony, rzeczywisty restart ustawia `remindedGroupIndexes: []` w tym samym warunkowym `UPDATE … WHERE completedAt IS NOT NULL` i transakcji, która zeruje ukończenie, ustawia nową datę otwarcia i kasuje odhaczenia (`joinChecklist`). Znaczniki zostają nietknięte przy: ponowieniu żądania z tą samą datą, odmowie zmiany daty (409), zablokowanym restarcie (409) i uzupełnieniu pustej daty starszej nieukończonej ściągi. Ponowione lub równoległe żądanie po restarcie nie kasuje znacznika zapisanego już w nowym cyklu (restart wykonuje się raz).

Testy (`tests/db/checklist-join.test.ts`, początkowe znaczniki `[1, 2]`, 7 nowych): restart → `[]`; ta sama data, odmowa innej daty, dwa warianty zablokowanego restartu, uzupełnienie pustej daty → `[1, 2]`; po restarcie zapisany `[1]` przeżywa powtórzone żądanie (ta sama i inna data); dwa równoległe restarty → jeden, a znacznik `[2]` zapisany potem przeżywa spóźniony duplikat. Mutacje: bez resetu pada 3 testy, reset przy uzupełnianiu daty pada 1. Żadnych e-maili — testy nie dotykają nadawcy.

Sprawdzone w lokalnej przeglądarce (`JoinChecklistButton`): wartość początkowa i `max` = dzień w Europe/Warsaw (2026-10-02); udane dołączenie → przekierowanie do „Moje konto” i ściąga z datą dnia; próba z inną datą, gdy data jest już zapisana (druga karta) → widoczny komunikat „Data otwarcia konta jest już zapisana i nie można jej zmienić.”, zapisana data i znaczniki `[1, 2]` bez zmian. (Granica północy w Polsce jest pokryta testem bazodanowym z wstrzykniętym czasem — przeglądarka działa w czasie rzeczywistym.)

Bez zmian (zgodnie z poleceniem): puste teksty `""` zapisywane jako `""`.
