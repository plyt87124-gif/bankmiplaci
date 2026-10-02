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
2. **Uczestnicy ściągi bez `accountOpenedAt`** (starsze zapisy sprzed wymogu daty) nie mają w UI sposobu na jej uzupełnienie; ich Kantor pozostaje opcjonalny. Jeśli takich osób jest więcej niż kilka — osobna drobna zmiana.
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

Poza zakresem, zauważone: w formularzu admina pusta wartość „Źródło warunków (URL)”, „Okres karencji” i „data graniczna” również nie czyści zapisanej wartości (to samo `undefined` → pominięcie).
Nie zmieniałem tego — to osobna decyzja o semantyce formularza.
