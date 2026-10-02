# Etap 1 — kolejność wdrożenia, zgodność wersji, korekty danych

Stan: przygotowane do oceny. **Nic z poniższego nie zostało wykonane na produkcji**
(ani migracje, ani korekty danych, ani wdrożenie aplikacji, ani push brancha).

Branch: `fix/etap1-claude-code-poprawki`.

## 1. Kolejność (obowiązkowa)

| Krok | Co | Kto/jak | Dlaczego w tym miejscu |
|---|---|---|---|
| 0 | Kopia bazy (snapshot/branch w Neon) | właściciel | punkt powrotu dla całości |
| 1 | **Migracje schematu** (4 szt.) | `npm run prisma:deploy` z produkcyjnym `DATABASE_URL` | nowa aplikacja czyta nowe kolumny; bez nich każde zapytanie o promocję zwróciłoby błąd 500 |
| 2 | **Wdrożenie aplikacji** (merge brancha → Vercel) | właściciel | dopiero ta wersja rozumie `availableUntil`, warunki zwolnienia z opłat i regułę „ostatni dzień” |
| 3 | Sprawdzenie po wdrożeniu (sekcja 4) | | zanim ruszą się dane |
| 4 | **Korekty danych** — mBank, potem Erste | `scripts/data-corrections/*.js` najpierw dry-run, potem `--apply` | stara aplikacja nie zna nowych kolumn; dane nowego typu mają sens dopiero po kroku 2 |
| 5 | `npm run audit:fees` na produkcji | | lista rekordów z opłatami do weryfikacji (nic nie jest zmieniane) |
| 6 | Decyzja o statusie Erste (ACTIVE?) | właściciel, po potwierdzeniu w eBrokerPartner | patrz „Blokery” |

Kroku 1 i 2 nie wolno zamienić miejscami. Kroku 4 nie wolno wykonać przed 2.

## 2. Migracje

Wszystkie cztery są **addytywne albo rozluźniające** — nie usuwają ani nie przepisują danych.

| Plik | Skutek |
|---|---|
| `20261001185523_fees_nullable_and_waiver_conditions` | `fees`: +`accountFeeWaiverCondition`, +`cardFeeWaiverCondition` (TEXT NULL); `accountFeeCents`, `cardFeeCents`, `atmFeeCents`: `DROP NOT NULL`, `DROP DEFAULT`. Istniejące wartości (w tym 0) zostają bez zmian — migracja **nie** uznaje ich za „potwierdzone”. |
| `20261001190152_article_content_updated_at` | `articles`: +`contentUpdatedAt` (TIMESTAMP NULL) |
| `20261001194006_promotion_content_updated_at` | `promotions`: +`contentUpdatedAt` (TIMESTAMP NULL) |
| `20261002102019_bonus_part_available_until` | `bonus_parts`: +`availableUntil` (TIMESTAMP NULL) |

Blokady: dodanie kolumny NULL bez domyślnej wartości oraz `DROP NOT NULL/DEFAULT` to operacje wyłącznie na metadanych
(ułamek sekundy, krótka blokada tabeli).

## 3. Zgodność z działającą wersją aplikacji (po kroku 1, przed krokiem 2)

* Stary klient Prisma wymienia kolumny jawnie → nowych kolumn nie widzi i nie przeszkadzają.
* Stary kod zapisuje `fees` zawsze z jawnymi liczbami (formularz, import) → usunięcie `DEFAULT 0` go nie dotyka.
* Stary klient traktuje `accountFeeCents` itd. jako `Int` (nie NULL). Dopóki żaden wiersz nie ma NULL, nic się nie dzieje;
  **NULL pojawi się dopiero**, gdy nowa aplikacja/admin zapisze puste pole. Dlatego po kroku 2 nie wolno wracać do starej wersji aplikacji
  bez wcześniejszego sprawdzenia `select count(*) from fees where "accountFeeCents" is null or "cardFeeCents" is null or "atmFeeCents" is null`.
* Wycofanie aplikacji po kroku 4: stara wersja zignoruje nowe kolumny, ale (a) pokaże karę mBanku jako „9 zł” bez warunku w tabeli, (b) wliczy
  zakończone części Kantoru do sumy premii Erste. Przed takim wycofaniem cofnij korekty danych (sekcja 5).

## 4. Sprawdzenie po wdrożeniu aplikacji (krok 3)

```bash
curl -sI https://bankmiplaci.pl/jak-to-dziala | head -1                 # 200
curl -s  https://bankmiplaci.pl/sitemap.xml | grep -c "<loc>"            # liczba stron; /jak-to-dziala obecne
curl -s  https://bankmiplaci.pl/sitemap.xml | grep -c "<lastmod>"        # tylko strony z contentUpdatedAt
curl -sI https://bankmiplaci.pl/out/<slug-nieaktywnej> | grep -i -E "^(HTTP|location)"   # 307 -> /promocje?niedostepna=1
curl -s  https://bankmiplaci.pl/promocje/<slug> | grep -o '<meta name="robots"[^>]*>'
```

## 5. Korekty danych — `scripts/data-corrections/`

Pobranie adresu bazy (jak dotychczas): `npx vercel env pull .env.production.check --environment=production --yes`
(plik jest w `.gitignore`; usuń go po użyciu).

```bash
node scripts/data-corrections/mbank-card-fee.js      # dry-run (domyślnie), nic nie zapisuje
node scripts/data-corrections/erste-platinum.js      # dry-run
node scripts/data-corrections/<skrypt>.js --apply    # dopiero po akceptacji
node scripts/data-corrections/<skrypt>.js --revert revert-<nazwa>-<czas>.json   # [--force]
node scripts/data-corrections/selftest.js            # test mechanizmu na LOKALNEJ bazie
```

Zabezpieczenia (`lib.js`, sprawdzone przez `selftest.js`):

* **Identyfikacja** po slugach / id wierszy, zero wzorców.
* **Jedna transakcja** — wszystkie zmiany albo żadna.
* **Compare-and-set** — każdy `UPDATE` ma `WHERE kolumna IS NOT DISTINCT FROM <wartość z dry-runu>`. Jeśli ktoś w międzyczasie zmienił to pole
  (admin, import), 0 wierszy pasuje, transakcja się wycofuje i **nic nie zostaje nadpisane**. Przeliczenie rankingu zmienia tylko `rating`
  i `updatedAt`, więc nie blokuje korekty. (Test wykrył i naprawił błąd: porównanie dat przez parametr `timestamptz` zależało od strefy sesji
  Postgresa — daty są teraz wiązane jako tekst ISO rzutowany na `timestamp`.)
* **Odtworzenie** — `--apply` najpierw zapisuje `revert-*.json` z dokładnymi poprzednimi wartościami; `--revert` przywraca je, ale odmawia,
  jeśli wiersz został w międzyczasie zmieniony (chyba że `--force`).
* `--apply` **odmawia**, jeśli w bazie brakuje wymaganej kolumny (czyli migracje nie zostały wdrożone).
* `lastVerifiedAt` **nie jest ruszane** żadną korektą — sprawdzono daty, nagrody i opłaty, nie całą ofertę.
* Bez zmian: slug, powiązania użytkowników, `UserPromotionTracking`, id/kolejność/postęp kroków ściągi, `status`, `affiliateUrl`.

## 6. Blokery i decyzje właściciela

1. **Status Erste.** Korekta zostawia `status = EXPIRED` (brak linku partnerskiego i przekierowania). Zmiana na `ACTIVE` wymaga potwierdzenia
   kampanii w panelu eBrokerPartner — sam regulamin banku (zapisy do 30.11.2026) tego nie rozstrzyga.
2. **Ściąga Erste** trzyma kroki Kantoru w grupie „Otwarcie konta”. Nowy uczestnik (po 30.09) zobaczy krok oznaczony „tylko jeśli przystąpiłeś…”,
   ale grupa nie zamknie się, dopóki go nie odhaczy. Trwałe rozwiązanie wymaga `ChecklistStep.availableUntil` + filtrowania po dacie
   przystąpienia użytkownika (kilka miejsc w kodzie: `/konto`, przełączanie kroków, przypomnienia). Obecnie jeden użytkownik śledzi tę promocję
   (nieukończoną); zmiana jest wyłącznie tekstowa i go nie dotyka.
3. **Starsze rekordy bez `contentUpdatedAt`** nie mają `<lastmod>` w mapie witryny (celowo — nie ma wiarygodnej daty). Pojawi się po pierwszej realnej edycji.
4. **`/opengraph-image`** — lokalnie (Windows) `next build` pada przez `path.join` w dołączonym `@vercel/og`; na Vercelu (Linux) działa.
   Pełny build lokalny: `npm run build:win`. Brak środowiska Linux na tym komputerze (WSL/Docker), więc nie ma tu przebiegu na Linuksie.
5. **Historyczny canonical Millennium (obca domena)** — przyczyna **nieustalona**. Aktualny test GSC i kod są poprawne; hipoteza „artefakt Google” nie
   została potwierdzona. Do sprawdzenia po ponownym skanowaniu (14/28 dni).
6. **Lint** — w repozytorium nie ma konfiguracji ESLint (`next lint` pyta interaktywnie); nie dodawałem jej bez Twojej decyzji.
7. **Zgłoszenia map w GSC** (cztery błędne) — czynność administracyjna w Google, poza kodem.
