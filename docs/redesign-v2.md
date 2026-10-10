# Redesign v2 „Papier i tusz” – przewodnik właściciela

Stan opisu: 2026-10-10, gałąź `redesign/v2`, ostatni commit `e466b5c`. Dokument jest po to, żebyś (a) mógł wrócić do starej wersji w całości, (b) mógł wybrać, które części nowej wersji zostawić, (c) wiedział, co trzeba zrobić przed wdrożeniem. Każdy hash, nazwa pliku i liczba poniżej zostały sprawdzone w repozytorium w dniu pisania (`git log`, `ls`, uruchomienie testów). Czego nie sprawdzałem, jest wprost oznaczone.

Spis treści:

1. Co to jest i gdzie leży
2. Jak wrócić do starej wersji
3. Jak wybrać części (pick-list)
4. Co się zmieniło dla użytkownika i dla SEO
5. Lista kontrolna przed wdrożeniem na produkcję
6. Czego świadomie NIE zrobiono
7. Decyzje podjęte po drodze
8. Jak uruchomić i sprawdzić lokalnie
9. Dodatek: gdzie co leży (dokumenty, pliki)

---

## 1. Co to jest i gdzie leży

**Redesign v2 („Papier i tusz”)** to przebudowa wyglądu i części zachowania serwisu Bankmiplaci. Kierunek: serwis ma wyglądać jak rzetelny dział finansowy dobrej gazety, a nie jak aplikacja z bonusami. Ciepły papier jako tło, tusz jako tekst, kwota szeryfowym fontem jako bohater karty, cienkie linie zamiast cieni, jeden kolor akcji (głęboki teal). Domyślnie jasny motyw, ciemny w pełni dopracowany, przełącznik Jasny / Ciemny / Automatycznie. Pełne uzasadnienie: `docs/redesign-v2/00-direction.md`.

**Gdzie to leży:**

- Gałąź `redesign/v2` na Twoim komputerze (repozytorium `C:\Users\plyt8\Desktop\bank-promo-comparator`).
- **Nic nie zostało wypchnięte (`git push`) ani wdrożone.** Zdalne repozytorium na GitHubie (`origin`) nie zna ani tej gałęzi, ani tagów `v1-pre-redesign` i `v2-*`. Produkcja (bankmiplaci.pl) działa na starym kodzie.
- Redesign obejmuje **30 commitów** na gałęzi (`git log --oneline v1-pre-redesign..HEAD`), 276 zmienionych plików w porównaniu z tagiem `v1-pre-redesign` (`git diff --shortstat v1-pre-redesign HEAD`: +32175 / −3425 linii), w tym 46 plików w katalogu `tests`. Zmiany fali E (bramki jakości) dochodzą na wierzch jako kolejne commity.
- Poza zakresem redesignu: panel administratora `/admin` (poza dwoma drobiazgami opisanymi niżej) oraz wszystko, co dotyczy eBroker, kampanii i przypomnień w katalogu `scripts/` i `src/lib/` (to osobne strumienie pracy; w drzewie roboczym leżą ich niezacommitowane pliki, np. `src/lib/campaignMonitor.ts`, `scripts/ebroker_catalog.py` – nie należą do redesignu i nie są w tym dokumencie opisywane).

### Tagi

| Tag | Wskazuje na | Ile commitów od `v1-pre-redesign` | Co zawiera |
|---|---|---|---|
| `v1-pre-redesign` | `bb19687` (2026-10-07) | 0 | **Stara wersja**: kod po Etapie 1 + automatyczna kontrola ofert eBroker i 16 nowych promocji (commit `bb19687`). Patrz uwaga niżej. |
| `v2-m1-foundation` | `96a90f9` | 5 | Specyfikacja (docs), „Polecane” z wynagrodzeniem partnerskim, serwis kart ofert, biblioteka SEO, **fundament designu** (kolory, fonty, komponenty `ui`, strony błędów). Stare strony zostają, ale w nowych kolorach i fontach. |
| `v2-m2-trust-motion-auth` | `85f0c32` | 9 | Do tego: komponenty zaufania (ujawnienie partnerskie, świeżość weryfikacji), ruch (animacje z poszanowaniem „ogranicz ruch”), nowy modal logowania + zgoda na regulamin przy rejestracji, układ stron prawnych. **Bez** nowego nagłówka i stopki. |
| `v2-m3-pages` | `f06eee1` | 29 | Wszystkie strony przebudowane: nagłówek/stopka, lista i strona promocji, ściąga, porównanie, quiz, strony treści, blog, strona główna, huby SEO, poprawki po recenzjach. |
| (koniec gałęzi) | `e466b5c` | 30 | Jeden commit ponad `v2-m3-pages`: krótka etykieta sortowania „Polecane”. **Tag `v2-m3-pages` nie obejmuje tego commitu.** Po fali E tag może zostać przesunięty; sprawdź `git rev-parse --short v2-m3-pages`. |

### Ważna uwaga: stara wersja z tagu ≠ dokładnie to, co jest teraz na produkcji

Sprawdziłem relację między gałęziami:

- Produkcja (Vercel wdraża `main`) prawdopodobnie stoi na `origin/main` = **`5d14e8a`** (Etap 1 z PR #1 i #2 + poprawka statystyk z PR #3). Sprawdź w panelu Vercel → Deployments, który commit ma etykietę „Production”.
- Tag `v1-pre-redesign` = `origin/main` do PR #2 **plus** commit `bb19687` z automatyką eBroker, którego **nie ma** w `origin/main` (nie był wypchnięty ani zmergowany) i **bez** poprawki statystyk z PR #3 (`7c00fe0`).
- Twój lokalny `main` stoi na `2801600` i jest **31 commitów za** `origin/main` (`git branch -vv`). Przed jakąkolwiek operacją na `main` zrób `git fetch origin`, a potem `git switch main` i `git pull`.
- Gałąź `redesign/v2` nie zawiera `7c00fe0` (poprawka statystyk). Gdy ją zmergujesz do aktualnego `origin/main`, ta poprawka dojdzie z drugiej strony. Próbny merge (`git merge-tree`, nic nie zmienia w repozytorium) pokazał **brak konfliktów** między `redesign/v2` a `origin/main` z dnia pisania.
- Wniosek: **merge `redesign/v2` do `main` wprowadza naraz trzy rzeczy**: redesign, automatykę eBroker (`bb19687`, w tym 2 migracje i nowe zadanie cron) oraz 2 migracje z samego redesignu. Jeśli chcesz tylko jedną z nich, patrz sekcja 3.

Żeby mieć punkt powrotu dokładnie do obecnej produkcji, zanim cokolwiek zmergujesz:

```bash
git fetch origin
git tag v1-produkcja-2026-10-10 origin/main
```

(`origin/main` ma dziś hash `5d14e8a`; tag lokalny, nic nie wysyła. Zrób go dopiero po potwierdzeniu w Vercel, że to ten commit jest na produkcji.)

---

## 2. Jak wrócić do starej wersji

Trzy sposoby, od najbezpieczniejszego. Plus czwarty, najszybszy w razie awarii po wdrożeniu.

### Sposób A. Po prostu zostać na `main` (nic nie robić)

Dopóki nie zrobisz merge `redesign/v2` do `main` i nie wypchniesz `main`, **nic się nie zmienia**: produkcja działa jak dotąd, a redesign jest tylko plikiem na Twoim komputerze. To jest stan obecny.

Przełączanie się między wersjami lokalnie nie niszczy niczego (zmiany niezacommitowane zachowaj najpierw: `git stash` albo commit):

```bash
git switch main            # stara wersja (po pull: taka jak produkcja)
git switch redesign/v2     # nowa wersja
```

Uwaga: przełączenie gałęzi zmienia pliki, ale **nie zmienia bazy danych**. Lokalna baza ma już zastosowane wszystkie migracje (także cztery nowe), co jest bezpieczne dla starego kodu (patrz niżej).

### Sposób B. Po merge do `main` – cofnięcie merge

Najpierw zapisz sobie punkt powrotu (przed merge):

```bash
git switch main
git pull
git tag przed-redesignem-v2          # lokalny znacznik: co było na main przed merge
git merge --no-ff redesign/v2        # tworzy jeden commit scalający
git log --merges --oneline -3        # zapisz hash commitu scalającego
```

Cofnięcie (bezpieczne, historia zostaje, można potem wypchnąć normalnym `git push`):

```bash
git revert -m 1 <hash-commitu-scalającego>
```

`-m 1` znaczy „zostaw stronę `main`, cofnij to, co przyszło z gałęzi”. Skutki i pułapki:

- Revert merge **cofa kod, nie cofa bazy danych** (patrz niżej: migracje).
- Cofnięcie merge zostawia w historii „dziurę”: gdy kiedyś zechcesz wprowadzić redesign ponownie, musisz najpierw cofnąć sam revert (`git revert <hash-revertu>`), inaczej git uzna zmiany za już wprowadzone.
- Alternatywa „twardy reset” (`git reset --hard przed-redesignem-v2`) przepisuje historię. Używaj tylko wtedy, gdy merge **nie został jeszcze wypchnięty**. Po wypchnięciu wymagałby `git push --force`, czego nie rób bez pełnej świadomości skutków.
- Commit scalający `--no-ff` istnieje właśnie po to, żeby dało się go jednym poleceniem cofnąć. Zwykły fast-forward (bez `--no-ff`) tego nie umożliwia, bo nie tworzy jednego commitu do cofnięcia.

### Sposób C. Wdrożenie ze starego tagu

Gdybyś musiał uruchomić starą wersję obok nowej (np. porównać, albo wdrożyć ją osobno):

```bash
git fetch --tags
git worktree add ..\bankmiplaci-v1 v1-pre-redesign
cd ..\bankmiplaci-v1
npm ci
```

To tworzy drugi katalog ze starym kodem, bez ruszania Twojej gałęzi. Usunięcie: `git worktree remove ..\bankmiplaci-v1`.

Pamiętaj o różnicy opisanej w sekcji 1: tag `v1-pre-redesign` zawiera automatykę eBroker, której produkcja nie ma, a nie zawiera poprawki statystyk (PR #3). Jeśli chcesz dokładnie obecną produkcję, użyj `origin/main` (`5d14e8a`) lub tagu `v1-produkcja-2026-10-10` z sekcji 1:

```bash
git worktree add ..\bankmiplaci-prod origin/main
```

### Sposób D (najszybszy po wdrożeniu). Cofnięcie wdrożenia w Vercel

Jeśli po wdrożeniu coś się psuje, najszybsza droga to nie git, tylko panel Vercel: Deployments → poprzednie wdrożenie produkcyjne → „Promote to Production” / „Instant Rollback” (nazwa przycisku zależy od wersji panelu; nie sprawdzałem jej w tej sesji). Przywraca stary kod w kilkanaście sekund, bez zmian w repozytorium. Baza danych się nie cofa (patrz niżej), ale stary kod z niej korzysta bez problemu.

### Migracje bazy: co się cofa, a co nie

**Migracje bazy NIE cofają się same.** Ani `git revert`, ani wycofanie wdrożenia nie usuwa zmian ze schematu. Prisma nie ma „migracji w dół”. W tym przypadku to jednak nie jest problem, bo wszystkie cztery nowe migracje są **addytywne** (dodają, nic nie usuwają i nie przepisują danych). Sprawdziłem treść każdej (`prisma/migrations/…/migration.sql`):

| Migracja | Co robi | Pochodzi z | Czy stary kod działa na bazie po niej |
|---|---|---|---|
| `20261007120000_ebroker_watch` | Dodaje 6 wartości do typu `AdminNotificationType`, kolumnę `admin_notifications.dedupKey` (nullable, indeks unikalny) i nową tabelę `ebroker_campaigns` | `bb19687` (automatyka eBroker, jest w tagu `v1-pre-redesign`) | Kod z tagu `v1-pre-redesign`: tak, zna ją. Kod z `origin/main` (bez eBroker): tak dla zapytań o promocje i użytkowników; **jedno ryzyko** – jeśli w tabeli powiadomień pojawią się wiersze z nowymi typami (tworzy je codzienny cron `ebroker-watch`), stary panel admina może nie umieć ich odczytać (Prisma zgłasza nieznaną wartość typu wyliczeniowego). Wniosek: przed wycofaniem do kodu bez eBroker usuń lub zarchiwizuj te powiadomienia albo wyłącz cron. To moja ocena z analizy kodu i schematu, nie test. |
| `20261007130000_ebroker_campaign_skip_reason` | Dodaje kolumnę `ebroker_campaigns.skipReason` (nullable) | `bb19687` | Tak (tabela dotyczy tylko eBroker). |
| `20261008100000_promotion_affiliate_commission` | Dodaje kolumnę `promotions.affiliateCommissionCents` (INTEGER, nullable) | `eb604b3` | Tak. Stary kod nie wybiera tej kolumny, więc jej nie widzi; wstawianie nowych promocji zostawia NULL. |
| `20261008120000_user_terms_acceptance` | Dodaje `users.termsAcceptedAt` (TIMESTAMP, nullable) i `users.termsVersion` (TEXT, nullable) | `53ca5a3` (schemat), używana od `e291269` (rejestracja) | Tak. Dla istniejących kont zostaje NULL, co znaczy „brak zapisanej zgody”, a nie „zgoda udzielona”. |

Sprawdziłem też, że po `20261008120000_user_terms_acceptance` **nie ma nowszych migracji** w `prisma/migrations` (ostatnia na liście). Całość historii to 27 migracji; produkcja ma 23 (po Etapie 1, wg notatek z 2026-10-03).

Wniosek: **wycofanie samego kodu na bazę po nowych migracjach jest bezpieczne**, o ile wracasz do kodu z tagu `v1-pre-redesign` (zna on migracje eBroker). Przy powrocie do kodu bez eBroker pamiętaj o powiadomieniach z nowymi typami (wyżej).

Gdybyś kiedykolwiek chciał fizycznie usunąć nowe kolumny, to osobna, ręczna operacja SQL – nie jest potrzebna do powrotu do starej wersji i nie polecam jej bez potrzeby.

---

## 3. Jak wybrać części (pick-list)

### 3.1 Najpierw szczera uwaga

Redesign nie jest zbiorem niezależnych klocków. Fundament (WP-01: kolory, fonty, komponenty `ui`) jest używany przez wszystko, a duża część stron współdzieli też komponenty (np. karta oferty, ujawnienie partnerskie, nawigacja, model opłat). Przy tych zależnościach:

- **„Chcę nowy wygląd strony głównej, ale starą listę promocji” – zwykle NIE da się tego zrobić czysto.** Strona główna (WP-08) renderuje kartę ofert, strip ujawnienia, sekcje i hero z komponentów, które pochodzą z listy promocji (WP-09), zaufania (WP-04) i ruchu (WP-05), a wszystkie opierają się na tokenach WP-01. Stara lista promocji zależy od starych klas koloru. Zmieszanie ich daje dwa różne języki wizualne na jednej stronie, a technicznie wymaga ręcznego przepisania importów. Realne są tylko „punkty odcięcia” (tagi), nie dowolne mieszanki.
- **Cofnięcie pojedynczego, starego commita zwykle powoduje konflikty**, bo późniejsze commity zmieniały te same pliki. Sprawdziłem to: dla każdego z 30 commitów zasymulowałem `git revert` na końcu gałęzi (`git merge-tree`, bez zmian w repozytorium). **Tylko 3 commity cofają się bez konfliktów tekstowych**: `84ca830` (ruch), `3add155` (poprawka 404 w produkcji) i `e466b5c` (etykieta sortowania). Ale „bez konfliktów” nie znaczy „bez błędów”: cofnięcie `84ca830` (komponenty `Reveal`, `CountUp`) zepsułoby kompilację, bo późniejsze strony ich importują. Nie cofaj pojedynczych commitów, jeśli nie masz na to czasu na naprawy.
- Zasymulowałem również odwrotny kierunek: przeniesienie (`cherry-pick`) pojedynczego commita na stary tag `v1-pre-redesign`. Czysto, bez konfliktów tekstowych, przenoszą się: `eb604b3`, `57161a7`, `5438a95`, `96a90f9`, `e744adb`, `e291269`, `85f0c32`, `0d9a82b`, `baddcd6`, `7f80de3`, `8a9b761`, `3f68099`, `995267f`. Pozostałe wymagają wcześniejszych commitów. To tylko test tekstowy: **nie uruchamiałem kompilacji ani testów dla żadnej mieszanki**, więc po każdej próbie zrób `npx.cmd tsc --noEmit`, `npm test` i `npm run build:win`.

**Najbezpieczniejsza metoda wyboru:** zrób próbną gałąź i sprawdzaj na niej, nigdy na `main`:

```bash
git switch -c proba-mieszanki v1-pre-redesign     # albo origin/main
git cherry-pick <hash1> <hash2> ...               # w kolejności z tabeli
npx.cmd tsc --noEmit
npm test
```

Nie podoba się? `git switch redesign/v2` i `git branch -D proba-mieszanki`. Nic nie jest tracone.

### 3.2 Kolejność zależności (ściąga)

```
WP-01 fundament  ──┬─ WP-04 zaufanie ──┬─ WP-06 nagłówek/stopka (+ WP-07 logowanie)
(tokeny, fonty)    ├─ WP-05 ruch ──────┤
                   ├─ WP-07 logowanie  ├─ WP-09 lista ──┬─ WP-08 strona główna
WP-02 SEO ─────────┤                   │               └─ WP-16 huby SEO
WP-03 dane/Polecane┘                   ├─ WP-10 strona promocji (używa też WP-11, WP-13)
                                       ├─ WP-11 ściąga/komentarze
                                       ├─ WP-12 porównanie i quiz
                                       ├─ WP-13 strony treści
                                       ├─ WP-14 strony prawne
                                       └─ WP-15 blog
```

Zależności formalne pochodzą z `docs/redesign-v2/05-work-packages.json` (pole `dependsOn`), a rzeczywiste importy sprawdziłem skryptem po kodzie. Różnice między planem a kodem zaznaczone w tabeli (kolumna „Zależy od”).

### 3.3 Tabela pakietów

Legenda ryzyka cofnięcia: **niskie** = commit cofa się czysto i nic się nie psuje; **średnie** = cofnięcie wymaga ręcznych poprawek w kilku plikach; **wysokie** = cofnięcie rozsadza kompilację albo wiele innych pakietów. „Konflikty” = liczba konfliktów `git revert` na końcu gałęzi (symulacja opisana wyżej).

| Pakiet | Co zmienia (dla człowieka) | Commity (hash) | Zależy od (plan → faktyczne importy) | Cofnięcie osobno (`git revert <hash>`) |
|---|---|---|---|---|
| **Przed redesignem: „Polecane”** | Domyślne sortowanie „Polecane” łączy ocenę serwisu z wynagrodzeniem partnerskim; pole prowizji w adminie; opis w `/jak-zarabiamy` | `eb604b3` | brak | Kod: 7 konfliktów. Zawiera migrację `20261008100000` (kolumna zostaje w bazie). Ryzyko **wysokie** – późniejsze commity opierają na tym całą logikę ujawnień. |
| **Specyfikacja** | Dokumenty `docs/redesign-v2/00…05` | `57161a7` | brak | Tylko dokumentacja, **niskie** ryzyko (4 konflikty w tekście, bez wpływu na działanie). |
| **WP-03** Serwis kart ofert, pola zgody | Jedno zapytanie o karty ofert z wyraźnie ograniczonym zakresem pól (wynagrodzenie nigdy nie trafia do strony); pola zgody w `User`; ostrzeżenia w formularzu admina | `53ca5a3` | brak | 2 konflikty. Zawiera migrację `20261008120000`. Ryzyko **wysokie**: karty ofert (WP-08, WP-09, WP-16) czytają z tego serwisu. |
| **WP-02** Biblioteka SEO | Wspólne tytuły, opisy, canonical, JSON-LD, sitemap z prawdziwymi datami, `robots`, reguły indeksowania wygasłych ofert | `5438a95`; późniejsze zmiany w `src/lib/seo` w: `080cbfa`, `d7a9967`, `dd08427`, `361c8dc`, `cce1dfc`, `b363fde`, `f06eee1` | brak (w kodzie: `sitemapEntries` importuje listę kategorii bloga z WP-15 i `feeModel` z WP-10) | 9 konfliktów. Ryzyko **wysokie**: wszystkie strony importują `@/lib/seo`. |
| **WP-01** Fundament designu | Kolory jasny/ciemny, fonty (Source Serif 4 + Inter), przełącznik motywu, komponenty `ui/*` (Button, Badge, Card…), strony błędów 404/500, `layout.tsx` | `96a90f9` (+ dotknięcia `layout.tsx` w `e291269`, `361c8dc`, `b363fde`) | brak | 3 konflikty. Ryzyko **wysokie, nierozłączny**: wymagany przez wszystko poniżej. Tag `v2-m1-foundation` to bezpieczny przystanek. |
| **WP-04** Komponenty zaufania | Ujawnienie partnerskie w 4 wariantach (pasek nad listą, dopisek pod przyciskiem, stopka, znacznik), przycisk „Przejdź do promocji” jako zwykły link, wskaźnik świeżości weryfikacji i terminu | `e744adb`; poprawki treści w `b363fde`, `e466b5c` | WP-01 (plan) → faktycznie WP-01, WP-02 | 4 konflikty, ryzyko **wysokie**: ujawnienie jest wymogiem uczciwości listy (patrz sekcja 7). Nie usuwaj bez zastąpienia. |
| **WP-05** Ruch | Animacje wejścia, liczniki; przy „ogranicz ruch” wszystko statyczne; licznik zarobków bez iskier | `84ca830` | WP-01 | Cofa się bez konfliktów tekstowych, ale późniejsze strony importują `Reveal`/`CountUp` → kompilacja się wysypie. **Wysokie**. |
| **WP-07** Modal logowania, rejestracja | Logowanie w oknie `<dialog>` na całym serwisie, formularze logowania/rejestracji/reset hasła, **obowiązkowa zgoda na regulamin przy rejestracji** (zapis daty i wersji), poprawka otwartego przekierowania, nowy punkt `GET /api/account/me` | `e291269`; `995267f` (zapomniane hasło, WP-07b); część `cce1dfc` | WP-01, WP-03 | `e291269`: 1 konflikt, ale zmienia `layout.tsx` i przepływ logowania w całym serwisie. Ryzyko **średnie/wysokie**. Odpowiada za zapis `termsAcceptedAt`. |
| **WP-14** Strony prawne | Nowy układ `/regulamin`, `/polityka-prywatnosci`, `/cookies` (spis treści, typografia, okruszki); **treść prawna bez zmian** | `85f0c32`; `90a0c90` (okruszki, JSON-LD, 14b); `cce1dfc`, `b363fde` (opisy meta) | WP-01, WP-02 | `85f0c32`: 6 konfliktów, ale pakiet jest względnie samodzielny (zależy tylko od fundamentu i biblioteki SEO; nikt poza stronami prawnymi nie importuje `LegalPage`). Ryzyko **średnie**. |
| **WP-06** Nagłówek, stopka, menu | Lepki nagłówek, menu mobilne, stopka z ujawnieniem partnerskim i **danymi wydawcy** (jedno źródło `src/lib/publisher.ts`), jedno źródło nawigacji | `0d9a82b`; `361c8dc` (poprawki Header) | WP-01, WP-04, WP-05, WP-07 (plan) → faktycznie WP-01, WP-02, WP-03, WP-04, WP-07 | 4 konflikty, ryzyko **wysokie**: widoczny na każdej stronie, importowany przez `layout.tsx`. |
| **WP-09** Lista promocji | Karty ofert, filtry z arkuszem na telefonie, stany puste, paginacja; wspólny model opłat w kartach | `4a96dad`; poprawki: `b5ef311`, `48fef71` (trasy), `b363fde` | WP-01…05 (plan) → faktycznie też importuje z WP-07 i WP-10 (model opłat) | 15 konfliktów (największy pakiet), ryzyko **wysokie**. Używana przez stronę główną i huby. |
| **WP-10** Strona promocji | „W skrócie”, warunki krok po kroku, tabela opłat, źródło, FAQ, pasek CTA na telefonie; jeden **model opłat** (`src/lib/feeModel.ts`) dla strony, JSON-LD i kart | `baddcd6`; poprawki: `dd08427` (model opłat), `48fef71` (prawdziwy 404), `3add155` (błąd 500 na nieistniejącym adresie) | WP-01…05 → faktycznie też WP-09, WP-11 (ściąga), WP-13 (FAQ) | `baddcd6`: 10 konfliktów, ryzyko **wysokie**. |
| **WP-11** Ściąga, komentarze, „Moje konto” | Wygląd ściągi, komentarzy, baneru kwalifikacji i strony `/konto`. **Logika bez zmian** (miesiące, karencja, przypomnienia) poza poprawkami błędów interfejsu (fokus, anulowanie żądań) | `7f80de3`; `bdb484a` | WP-01, WP-04, WP-05 → faktycznie też WP-07 | 4 konflikty, ryzyko **średnie**. Odłączalny od listy, ale używany na stronie promocji. |
| **WP-12** Porównanie i quiz | Tabela porównania z przyklejoną kolumną, quiz po jednym pytaniu; **odpowiedzi quizu naprawdę wpływają na wynik** | `8a9b761`; `bdb484a` | WP-01…04 → faktycznie też WP-10 (model oferty, model opłat) | 4 konflikty, ryzyko **średnie**. |
| **WP-13** Strony treści | `/metodologia`, `/o-nas`, `/jak-zarabiamy`, `/faq`, `/jak-to-dziala`, `/kontakt` (kontakt z escapowaniem adresu e-mail) | `080cbfa`; `cce1dfc` (uczciwy opis wpływu wynagrodzenia, jedno źródło danych wydawcy) | WP-01, WP-02, WP-04, WP-05 → faktycznie też WP-03, WP-06 (dane wydawcy) | `080cbfa`: 6 konfliktów, ryzyko **średnie**. Zawiera uczciwe opisy ujawnienia; cofnięcie ich osłabia zgodność z prawem. |
| **WP-15** Blog | Lista, kategorie, artykuł z bezpiecznym renderem markdown, przypisy; przekierowanie `/blog/kategoria` → `/blog` | `3f68099`; `361c8dc`; `3add155`; `48fef71` | WP-01, WP-02, WP-04, WP-05 → faktycznie też WP-03, WP-09 | `3f68099`: 7 konfliktów, ryzyko **średnie**. Dodaje zależności `unified`, `remark-parse` (w `f06eee1`). |
| **WP-08** Strona główna | Hero z wyborem segmentu, „Polecane” ze stripem ujawnienia, kończące się promocje, sekcja wysiłku, pasek quizu, zaufanie, skrót FAQ | `005e453`; `f06eee1` (poprawki) | WP-01…05, WP-09 → faktycznie też WP-12 (quiz), WP-13 (FAQ) | `005e453`: 3 konflikty, ryzyko **średnie**: stronę można zastąpić starą, ale tylko razem z zachowaniem kart (WP-09). |
| **WP-16** Huby SEO (faza 1) | `/konta-osobiste-z-premia`, `/konta-firmowe-z-premia`, `/banki`, `/banki/[slug]`, `/promocje/konczace-sie` | `d7a9967`; `f06eee1` | WP-01…05, WP-09 → faktycznie też WP-13 | 4 konflikty, ryzyko **niskie/średnie**: to nowe strony, nikt ich nie importuje poza nawigacją i sitemapą. Wyłączasz flagami w `src/lib/seo/routes.ts` (`live: false`, `DYNAMIC_ROUTE_FLAGS`), bez cofania kodu. |
| **POLISH** (poprawki przekrojowe) | Spójne ujawnienie „Polecane”, „od 0 zł” na kartach przy zastrzeżeniach, jedna karencja, jedna stopka, opisy meta stron prawnych, a11y (44 pliki!) | `b363fde` | wszystkie | 4 konflikty, ryzyko **wysokie**: przekrojowy, nie cofaj bez powodu. |
| **Po recenzjach fali D** | Bez animacji przy listach, nagłówki bezpieczeństwa, noindex logowania admina i pustego bloga, łagodniejsze opisy warunków, zależności `unified`/`remark-parse` | `f06eee1` | wszystkie | 1 konflikt, ryzyko **średnie**. |
| **Etykieta sortowania** | Krótka etykieta „Polecane (z wynagrodzeniem)” w natywnym select (pełne ujawnienie stoi nad i pod kontrolką) | `e466b5c` | WP-04 | Cofa się czysto, ryzyko **niskie** (ale wraca ucinanie tekstu na telefonie). |
| **WP-17** (nie zrobiony) | Sesja poza layoutem → cache/ISR | brak | – | – patrz sekcja 6 |
| **WP-18** Bramki jakości (fala E) | Testy tokenów i kontrastu, audyt dostępności, lint | w drzewie roboczym w chwili pisania (np. `tests/ui-tokens.test.ts`, `tests/contrast.test.ts`), skrypt `scripts/a11y-audit.mjs` jeszcze nie istnieje | strony WP-06…16 | Same testy/narzędzia, nic nie zmieniają dla użytkownika. |

### 3.4 Gotowe przepisy

**Przepis 1. Wszystko (zalecany, jeśli redesign Ci się podoba).** `git merge --no-ff redesign/v2` (sekcja 2B). Wymaga całej listy z sekcji 5.

**Przepis 2. Tylko fundament wyglądu: kolory i fonty, stare strony bez zmian (przystanek `v2-m1-foundation`).** Najmniejsza zmiana wizualna. W tagu są też „Polecane” z wynagrodzeniem i serwis kart (zachowanie, nie wygląd), więc ujawnienie z tego etapu jest słabsze niż w wersji końcowej (patrz przepis 5). Wg opisu pakietu WP-01 (`05-work-packages.json`) stare nazwy kolorów zostają jako aliasy, żeby niezmigrowane strony się kompilowały; **nie oglądałem tego etapu w przeglądarce ani nie budowałem go osobno**, więc traktuj to jako hipotezę do sprawdzenia:

```bash
git switch -c fundament main        # po git pull
git merge --no-ff v2-m1-foundation
```

Uwaga: `v2-m1-foundation` leży na gałęzi, która wyrasta z `v1-pre-redesign`, więc ten merge wciągnie też automatykę eBroker (`bb19687`), jeśli `main` jej jeszcze nie ma.

**Przepis 3. Do przystanku `v2-m2-trust-motion-auth`.** Dodaje komponenty zaufania, ruch, nowy modal logowania i układ stron prawnych. **Nie ma nowego nagłówka/stopki ani nowych list**, więc nowe komponenty są dostępne, ale prawie nigdzie jeszcze nie użyte (poza stronami prawnymi i logowaniem). Praktyczny sens ma głównie wtedy, gdy chcesz mieć zgodę na regulamin przy rejestracji (modal + `termsAcceptedAt`) bez przebudowy reszty.

**Przepis 4. Wszystko poza nowymi stronami SEO.** Zmerguj całość, potem wyłącz huby flagami w `src/lib/seo/routes.ts` (`live: false` dla czterech tras faz 1 i `bankPages: false`). Nawigacja i sitemap czytają te same flagi (`isRouteLive`), więc linki znikną razem ze stronami. Test `tests/seo-routes.test.ts` pilnuje, żeby flaga `true` miała stronę. Strony nadal odpowiadają pod swoim adresem, jeśli ktoś go zna. Żeby je naprawdę usunąć, trzeba skasować katalogi `src/app/banki`, `src/app/konta-*`, `src/app/promocje/konczace-sie` oraz powiązane testy (`tests/seo-pages*`), inaczej `npm test` zgłosi błędy.

**Przepis 5. Tylko „Polecane” z prowizją (zachowanie, bez wyglądu).** Commit `eb604b3` przenosi się na stary tag bez konfliktów. **Ostrzeżenie prawne:** ujawnienie z tego commitu jest słabsze niż końcowe. Przeglądy po drodze wykazały, że sformułowanie „m.in. wynagrodzenie” zaniża wpływ (współczynnik 0,6–1,0 przewyższa rozrzut całej oceny) i trzeba mówić wprost, że oferta o niższej ocenie może znaleźć się wyżej. Poprawione brzmienie jest w `src/lib/disclosureCopy.ts` (od `e744adb`, poprawiane w `b363fde`, `e466b5c`). Jeśli bierzesz „Polecane”, bierz razem z tym pakietem i z opisem w `/jak-zarabiamy`.

**Przepis 6. „Tylko SEO i treści, bez zmiany wyglądu”.** Szczerze: tylko częściowo.

- Czysto przenosi się commit `5438a95` (biblioteka SEO: `src/lib/seo/*`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/promotionAvailability.ts`, `src/components/JsonLd.tsx`, plus 8 plików testów). Efekt: sitemap z uczciwymi datami modyfikacji, ofert wygasłych dłużej niż 90 dni nie ma w sitemapie i mają `noindex`, ale **same strony nie zaczną korzystać z nowych tytułów, opisów i JSON-LD**, bo podpięcie następuje w commitach przebudowujących strony (`baddcd6`, `4a96dad`, `005e453`, `080cbfa` i inne). Wyciągnięcie samego SEO z tych commitów bez wyglądu to praca ręczna, nie `cherry-pick`.
- Treść stron prawnych **nie** została zmieniona w redesignie (porównałem `/regulamin`, `/polityka-prywatnosci`, `/cookies` ze starym tagiem: zmiany to wyłącznie nagłówki z `id`, spis treści, metadane i oznaczenia dostępności). Propozycje zmian są w `docs/redesign-v2/06-legal-text-proposals.md` i **nie są opublikowane**.
- Treści do przeniesienia ręcznie: teksty FAQ i `/jak-zarabiamy` (`src/app/faq/faqItems.ts`, `src/app/jak-zarabiamy/page.tsx`).

**Przepis 7. Nowa strona główna + stara lista promocji.** Nierealne (patrz 3.1). Jeśli bardzo potrzebujesz: strona główna importuje karty z WP-09, więc w praktyce trzeba cofać do poprzedniej wersji pliki `src/app/page.tsx`, `src/components/home/*` i przepisać je pod stare klasy.

### 3.5 Zachowanie funkcjonalne (nie tylko wygląd) – osobno

Poniższe zmiany **zmieniają działanie**, nie tylko wygląd. Przy wyborze części traktuj je jako osobne decyzje.

1. **Kolejność „Polecane” i wynagrodzenie partnerskie** (`src/lib/recommended.ts`, `eb604b3`). Domyślne sortowanie listy i strony głównej to „Polecane” (gdy nie wybrano innego). Wynik = ocena serwisu (0–10, przeskalowana do 0–1) × (0,6 + 0,4 × udział wynagrodzenia oferty w najwyższym wynagrodzeniu w tej samej grupie typu konta). Brak wynagrodzenia w bazie = wartość neutralna 0,5 (współczynnik 0,8). **Dziś wszystkie wynagrodzenia są puste (NULL)**, więc wszystkie oferty dostają ten sam współczynnik, a kolejność = ocena (sprawdziłem w lokalnej bazie: 0 z 35 ofert ma wypełnione wynagrodzenie; stan produkcji niesprawdzony). Po wypełnieniu pól wynagrodzenie **działa silniej niż różnice w ocenach** i oferta o niższej ocenie może wyprzedzić lepszą – i tak to jest opisane na stronie.
2. **Wynagrodzenie nigdy nie trafia do strony** (ani HTML, ani propsy komponentów, ani JSON, ani odpowiedzi RSC). Pilnują tego `stripPrivateFields`, jawny `select` w `PROMOTION_CARD_SELECT` i testy (`tests/commission-privacy.test.ts` i inne). `GET /api/promotions/active` zostało przy okazji doprecyzowane.
3. **Ocena serwisu jest liczona bez wynagrodzenia** (`ratings.ts` go nie używa); sortowanie „Najlepsza ocena” jest od niego niezależne.
4. **Model opłat** (`src/lib/feeModel.ts`, `dd08427`): jedno miejsce, które decyduje, co napisać o opłacie; ta sama odpowiedź na stronie oferty, w JSON-LD i na karcie. Brak danych = „Brak danych” (nigdy „0 zł”); „0 zł” z zastrzeżeniem w polu `otherFee` = „od 0 zł”; opłata z warunkiem zwolnienia pokazuje stawkę i „0 zł po spełnieniu warunku”.
5. **Modal logowania i rejestracja** (`e291269`): logowanie w oknie `<dialog>`; **rejestracja wymaga zaznaczenia zgody na regulamin**, sprawdzanej także po stronie serwera, z zapisem `termsAcceptedAt` i `termsVersion` (obecnie `2026-10`); poprawka otwartego przekierowania po logowaniu; nowy punkt `GET /api/account/me`. Istniejące konta niezmienione.
6. **Prawdziwe 404** (`48fef71`, `3add155`): nieistniejąca oferta lub artykuł zwraca 404, nie „miękki 404” (`loading.tsx` tylko w grupach tras `(lista)`); usunięto błąd 500 w produkcji na nieistniejącym adresie `/blog/…` (ISR na trasie dynamicznej).
7. **Indeksowanie** (sekcja 4): `noindex` dla pustego bloga, wariantów filtrów i logowania admina.
8. **Quiz**: odpowiedzi faktycznie wpływają na wynik (`8a9b761`).
9. **Kontakt**: adres e-mail z formularza jest escapowany w treści wiadomości (`080cbfa`).
10. **Admin** (poza zakresem redesignu, ale dotknięty): formularz promocji ma ostrzeżenia (za długie streszczenie, uzasadnienie oceny ze względnymi superlatywami) i etykietę przy polu prowizji; logowanie admina ma `noindex`. Reszta panelu bez zmian.
11. **Nagłówki bezpieczeństwa na wszystkich trasach** (`next.config.js`, `f06eee1`): `X-Content-Type-Options: nosniff` i `Referrer-Policy: strict-origin-when-cross-origin`.
12. **Bez zmian (świadomie):** zapis kliknięć i przekierowanie `/out/[slug]`, ściąga z odblokowywaniem miesięcy i karencja, komentarze, przypomnienia, cron, middleware, statystyki. Sprawdziłem różnice względem starego tagu: katalog `src/app/out`, plik `middleware.ts` (w głównym katalogu projektu) i katalog `scripts/` bez zmian.
13. **Automatyka eBroker** (z `bb19687`, nie z redesignu, ale wchodzi razem z gałęzią): codzienny cron `/api/cron/ebroker-watch` (04:30), powiadomienia w panelu admina i e-mail zbiorczy. Nigdy sam nie dodaje, nie przedłuża ani nie wygasza promocji.

---

## 4. Co się zmieniło dla użytkownika i dla SEO

### Użytkownik

- Nowy wygląd całego serwisu (papier/tusz/teal), fonty Source Serif 4 i Inter, przełącznik motywu Jasny / Ciemny / Automatycznie (zapamiętywany w przeglądarce).
- Lepki nagłówek, menu mobilne, jedna stopka z ujawnieniem partnerskim i danymi wydawcy (Michał Kamiński, JDG – dane już publiczne w regulaminie, jedno źródło: `src/lib/publisher.ts`).
- Lista: karty z kwotą jako bohaterem, filtry w arkuszu na telefonie, stany puste, sortowanie z opisem „Polecane (z wynagrodzeniem)”.
- Pasek ujawnienia partnerskiego **nad każdą listą ofert** i dopisek „Link partnerski” **pod każdym przyciskiem prowadzącym do banku**.
- Strona oferty: „W skrócie”, warunki krok po kroku, opłaty (z „Brak danych” zamiast zera), źródło, data weryfikacji, FAQ, pasek CTA na telefonie.
- Logowanie w oknie na dowolnej stronie; zgoda na regulamin przy rejestracji.
- Porównanie w tabeli z przyklejoną kolumną; quiz po jednym pytaniu.
- Dostępność: link „Przejdź do treści”, widoczny fokus, kontrast AA w obu motywach, szanowanie „ogranicz ruch”.

### Nowe strony i adresy

| Adres | Co to |
|---|---|
| `/konta-osobiste-z-premia`, `/konta-firmowe-z-premia` | Huby z listą ofert danego typu konta |
| `/banki`, `/banki/[slug]` | Przegląd banków i strona banku z jego ofertami |
| `/promocje/konczace-sie` | Oferty z kończącym się terminem |
| `/metodologia`, `/o-nas` | Jak liczymy ocenę serwisu (bez wynagrodzenia) i kto prowadzi serwis |
| `/konto/zapomniane-haslo` | Zapomniane hasło w nowym stylu z obsługą błędów |
| `/blog`, `/blog/[slug]`, `/blog/kategoria/[slug]` | Blog w nowym układzie (bez rzeczywistych artykułów, patrz sekcja 6) |

Strony `/jak-zarabiamy`, `/faq`, `/jak-to-dziala`, `/kontakt` istniały wcześniej; treść i układ zmienione.

### Przekierowania

- `/blog/kategoria` → `/blog` (przekierowanie stałe, 308), bo sam adres bez nazwy kategorii nie ma treści (`next.config.js`).
- Nieistniejące adresy ofert i artykułów zwracają prawdziwe 404.

### SEO

- **Tytuły i opisy** budowane jedną biblioteką (`src/lib/seo`): np. strona główna „Promocje bankowe {rok}…”, oferta „Bank: nazwa — do X zł | Bankmiplaci”, oferta zakończona „(zakończona dd.mm.rrrr)”. Rok i miesiąc w strefie Europe/Warsaw, kwoty i daty wyłącznie z bazy.
- **JSON-LD**: `Organization` i `WebSite` (strona główna), `BreadcrumbList` (okruszki), `FAQPage` (FAQ), `ItemList` (listy ofert), oferta jako `WebPage` + `FinancialProduct` + `BankOrCreditUnion`, `Article` (artykuły). **Brak** `Review` i `AggregateRating` (ocena serwisu jest wewnętrzna).
- **Sitemap** (`/sitemap.xml`): daty modyfikacji z prawdziwych dat treści (data zmiany treści albo data weryfikacji), brak `changefreq` i `priority`; oferty otwarte najpierw, zakończone (do 90 dni) na końcu; pusty blog i puste kategorie poza sitemapą; nowe huby i strony banków dołączone przez flagi `live`.
- **Polityka wygasłych ofert**: zakończona do 90 dni → indeksowana z banerem „Zakończona”, wyłączonym przyciskiem; po 90 dniach → `noindex,follow`; szkic/archiwum zawsze `noindex`.
- **`noindex`**: warianty list z parametrami (`?sort=`, `?bank=`, `?strona=2` itd. – crawl dozwolony, żeby robot zobaczył `noindex`, canonical na czystą ścieżkę), pusty `/blog`, puste kategorie bloga, logowanie admina, strona 404.
- `robots.txt` bez zmian w zasadach (blokada `/admin`, `/api`, `/out`).
- Strony prawne: **bez zmiany treści**; dodane tytuły/opisy, okruszki, spis treści. Propozycje zmian treści: `docs/redesign-v2/06-legal-text-proposals.md`, **nie opublikowane**, wymagają przeglądu prawnika.
- Obrazek OG (`src/app/opengraph-image.tsx`) w nowej tożsamości; jeden wspólny dla serwisu (obrazy per strona – patrz sekcja 6).

---

## 5. Lista kontrolna przed wdrożeniem na produkcję

Kolejność ma znaczenie. Nic z poniższego nie zostało wykonane.

### 5.0 Przygotowanie

- [ ] **Nie wypychaj gałęzi `redesign/v2` na GitHub, zanim wyłączysz dla niej podglądy Vercel.** Notatki z Etapu 1: zmienna `DATABASE_URL` w Vercel jest wspólna dla Preview i Production, a podgląd z nowym kodem uderzyłby w produkcyjną bazę bez nowych migracji (i mógłby w niej zapisywać). W `vercel.json` w sekcji `git.deploymentEnabled` są dziś wyłączone tylko `fix/etap1-claude-code-poprawki`, `fix/etap1-codex-readiness` (i `fix/stats-sequential-queries` w `origin/main`). Dodaj `"redesign/v2": false` i wypchnij to najpierw. (Nie edytowałem `vercel.json`, to poza zakresem tego dokumentu.)
- [ ] `git fetch origin` i aktualizacja lokalnego `main` (jest 31 commitów za).
- [ ] Zdecyduj, czy w jednym kroku wdrażasz też automatykę eBroker (patrz sekcja 1: wejdzie razem z gałęzią). Jeśli nie, rozdziel (sekcja 3).
- [ ] **Skrypty CI nie były uruchamiane na nowym UI.** `scripts/ci-visual.js` i `scripts/ci-smoke.js` (uruchamiane w `.github/workflows/ci.yml`) nie zostały zmienione od starej wersji, a zawierają asercje powiązane ze starym interfejsem (np. przycisk „Otwórz menu”, link „Przejdź do promocji”, tekst „Znany warunek zwolnienia…”, pierwszy akapit `<article>` jako podpis autora). Mogą nie przechodzić na nowym wyglądzie. Sprawdź to w CI na próbnym PR **zanim** zmergujesz do `main` (po wyłączeniu podglądów Vercel dla gałęzi, patrz pierwszy punkt tej listy) albo uruchom lokalnie z bazą testową. Nie testowałem tego.
- [ ] Kopia bazy przed migracjami (jak w Etapie 1): nowy branch w Neon (np. `backup-przed-redesignem-<data>`) lub `pg_dump`. W notatkach z 2026-10-03: projekt `sparkling-union-31264802`, branch produkcyjny `br-weathered-boat-b2byv5mz`; stary backup `backup-przed-etap1-2026-10-03-0712` zachowaj.

### 5.1 Migracje bazy na produkcji

Do zastosowania w tej kolejności (wszystkie addytywne, patrz sekcja 2):

1. `20261007120000_ebroker_watch`
2. `20261007130000_ebroker_campaign_skip_reason`
3. `20261008100000_promotion_affiliate_commission`
4. `20261008120000_user_terms_acceptance`

Sprawdzone w `prisma/migrations`: po tych czterech nie ma nowszych (ostatnia to `20261008120000`). Produkcja, wg notatek z 2026-10-03, ma 23 migracje (do `20261002161350_checklist_availability_and_affiliate_flag` włącznie), po zastosowaniu będzie 27.

**Migracje przed kodem, nigdy odwrotnie.** Nowy kod czyta `affiliateCommissionCents` i zapisuje `termsAcceptedAt`; bez migracji zapytania o promocje zwrócą błąd. Stary kod na nowej bazie działa, więc kolejność „migracje, potem wdrożenie” jest bezpieczna. Do uruchomienia migracji użyj tego, czego używałeś przy Etapie 1: skrypt `C:\Users\plyt8\Projekty\bankmiplaci-ops\prisma-prod.ps1` (sprawdzenie statusu, potem wdrożenie migracji z zabezpieczeniami). Nie uruchamiam go w ramach tego dokumentu. W PowerShell używaj `npx.cmd`, nie `npx`. Migracja `20261007120000` używa `ALTER TYPE … ADD VALUE`; Postgres w Neon (wg notatek PG18) to obsługuje.

### 5.2 Zmienne środowiskowe (Vercel → Production)

Sprawdziłem w kodzie (`grep process.env`), które są potrzebne:

| Zmienna | Do czego | Wymagana? |
|---|---|---|
| `DATABASE_URL` | połączenie z bazą | tak (już jest) |
| `NEXTAUTH_SECRET` | podpis sesji; bez niej logowanie rzuca błąd (`src/lib/userSession.ts`) | tak (już jest) |
| `NEXT_PUBLIC_SITE_URL` | adres serwisu w canonical, sitemap, JSON-LD, linkach w e-mailach. **Gdy brakuje albo jest błędna, kod cicho podstawia `http://localhost:3000`** (loguje ostrzeżenie raz) – canonical i sitemap wskazywałyby localhost. Ustaw `https://bankmiplaci.pl` i sprawdź po wdrożeniu `/sitemap.xml` | **tak, krytyczna dla SEO** (zmienna wbudowana w build: zmiana wymaga ponownego wdrożenia) |
| `CRON_SECRET` | autoryzacja wszystkich zadań cron, **także nowego `ebroker-watch`**; bez niej każdy cron zwraca 401 | tak (istniejące crony już jej używają) |
| `ADMIN_EMAIL` | adres, na który idzie zbiorczy e-mail z kontroli katalogu eBroker; bez niej powiadomienia są tylko w panelu | zalecana |
| `RESEND_API_KEY`, `EMAIL_FROM` | wysyłka e-maili (reset hasła, przypomnienia, e-mail eBroker); bez klucza e-maile nie są wysyłane, błąd tylko w logu | tak, jeśli e-maile mają działać (już używane) |
| `SUPPORT_EMAIL` | adres odbiorcy formularza kontaktowego; bez niej wiadomość z formularza **nie trafia nigdzie** (tylko wpis w logu) | zalecana |
| `NEXT_PUBLIC_SITE_NAME` | nazwa w tytułach (domyślnie „Bankmiplaci”) | opcjonalna |
| `INTERNAL_TRAFFIC_EMAILS` | wykluczenie Twoich zalogowanych odwiedzin ze statystyk | opcjonalna |
| `EBROKER_CATALOG_URL` | adres katalogu eBroker; domyślny jest wpisany w kod | opcjonalna |

Sprawdź w panelu Vercel samą obecność tych zmiennych (nie ich wartości); w tym dokumencie nie ma żadnych sekretów.

### 5.3 Uzupełnienie danych w panelu admina

Strona nie wymyśla danych: gdy czegoś brakuje, pokazuje „Brak danych”. Przed wdrożeniem uzupełnij:

- [ ] **Wynagrodzenia partnerskie** (`affiliateCommissionCents`): w panelu → Promocje → edycja oferty → pole „Prowizja partnerska — wpływa na kolejność „Polecane”, NIE wpływa na ocenę serwisu”. **Dziś NULL dla wszystkich ofert** (lokalna baza: 0 z 35; produkcja nie sprawdzana). Dopóki są puste, kolejność „Polecane” = kolejność wg oceny. Źródło kwot: panel eBrokerPartner. Wpisuj w złotych zgodnie z formularzem. Uwaga: po wypełnieniu kolejność się zmienia i jest tak uczciwie opisana na stronie.
- [ ] **Opłaty `otherFee` sprzeczne z „0 zł”.** Pole liczbowe mówi 0 zł, a tekst w `otherFee` opisuje warunek lub inną opłatę. Nowy model opłat pokazuje wtedy „od 0 zł” (nie „0 zł”), ale to wymaga przeglądu, czy liczba ma sens. Co wiem:
  - Wprost nazwane w dokumentacji (`docs/redesign-v2/03-content-and-seo-plan.md`, sekcja F, punkt 9): **Millennium** (tekst „potwierdzone przez administratora serwisu. Nie dostarczono osobnego Cennika…” widoczny publicznie) i **Revolut** („Dotyczy planu Standard. Inne plany…”). Proponowane przepisanie jest w tym dokumencie.
  - W lokalnej bazie z dnia pisania wszystkie 35 ofert ma wypełnione `otherFee`, a w 31 jednocześnie opłata za konto lub kartę wynosi 0 zł. Przykłady, gdzie tekst opisuje warunkowe zwolnienie z opłaty, a pole mówi 0 zł: **Erste** (konto dla osób 26+ pod warunkiem), **Bank Pekao** (karta/konto dla 26+ pod warunkiem), **mBank** (karta pod warunkiem transakcji), **Alior Bank** (karta przy min. płatnościach), **PKO Bank Polski** (karta przy min. transakcjach; Konto Firmowe), **BNP Paribas** (karta przy transakcjach), **Bank Pocztowy** (opłaty gotówkowe). To przegląd z fali D, nie pełny audyt; lokalna baza jest starszą kopią niż produkcja. Przeglądnij je w panelu (Promocje → oferta → opłaty): jeśli zwolnienie jest warunkowe, wpisz warunek w polu warunku zwolnienia, a nie 0 w polu stawki. Pomaga skrypt tylko do odczytu: `npm run audit:fees` (wypisuje rekordy z niezweryfikowanymi opłatami, niczego nie zmienia).
- [ ] **Warunki będące notatkami.** Część wierszy warunków oferty to notatki redakcyjne, pisane np. w pierwszej osobie, a nie kroki do wykonania przez klienta. Strona pokazuje je „łagodniej”, ale warto je przepisać na kroki. Wykryte przy przeglądzie wizualnym fali D; nie mam pełnej listy.
- [ ] **Logo banków (`Bank.logoUrl`)**: panel → Banki → pole adresu logo. W lokalnej bazie wszystkie 13 banków ma logo; **na produkcji nie sprawdzałem**. Bank bez logo dostaje monogram (litery w kafelku), więc brak nie psuje strony, ale wygląda gorzej.
- [ ] **Artykuły**: w lokalnej bazie jest 0 artykułów; pusty `/blog` jest `noindex` i poza sitemapą. Opublikuj artykuły (status opublikowany, kategoria, autor, daty) albo zostaw blog pusty (wtedy strona pokazuje informację o braku wpisów).
- [ ] **Data ostatniej weryfikacji ofert** (`lastVerifiedAt`) – to ona jest pokazywana jako „Zweryfikowano {data}”. Importy automatyczne nie powinny jej podbijać bez realnej weryfikacji; sprawdź daty przed wdrożeniem, bo oferty z datą starszą niż 45 dni dostają komunikat „sprawdzamy ponownie”.

### 5.4 Przegląd prawnika (przed publikacją na produkcji)

- [ ] **Teksty ujawnień** (`src/lib/disclosureCopy.ts`; opis w `docs/redesign-v2/04-trust-and-disclosure-plan.md`): pasek nad listą, dopisek pod przyciskiem, stopka, opis w `/jak-zarabiamy#polecane`. Pytanie do prawnika: UOKiK, nieuczciwe praktyki rynkowe, Omnibus (przejrzystość głównych parametrów rankingu). To nie jest porada prawna.
- [ ] **Dokument 06** (`docs/redesign-v2/06-legal-text-proposals.md`): propozycje zmian regulaminu, polityki prywatności i cookies (opis zapisów `localStorage["theme"]` i `sessionStorage["bmp_attribution"]`, retencja, odbiorcy danych, klauzula przy formularzu kontaktowym). **Nie opublikowane.** Brzmienia ze znacznikiem `[DO POTWIERDZENIA]` nie wolno publikować bez decyzji.
- [ ] **Dane wydawcy w stopce** (`src/lib/publisher.ts`): imię i nazwisko, forma prawna, adres, NIP, REGON, e-mail. Są zgodne z tym, co już jest w regulaminie; test `tests/navigation.test.tsx` pilnuje zgodności z regulaminem. Potwierdź, że to dane, które chcesz pokazywać w stopce każdej strony.
- [ ] **Zgoda na regulamin przy rejestracji** zapisuje wersję `TERMS_VERSION = "2026-10"` (plik `src/app/api/account/register/registerInput.ts`). Jeśli prawnik zmieni regulamin, podbij wersję.

### 5.5 Decyzja co do ofert ACTIVE z minionym terminem

W lokalnej bazie **12 z 35 ofert ma status ACTIVE, choć termin zapisów minął** (największy blok: oferty z terminem do 31.08.2026 i 30.09.2026, jedna do 13.09.2026; m.in. Bank Pekao, mBank, BNP Paribas, Millennium, Credit Agricole, Nest! BANK, Bank Pocztowy, PKO Bank Polski, Erste). Na produkcji liczba może być inna.

- Strona i tak nie pokazuje ich jako aktywnych (dostępność liczona z daty, nie ze statusu; „ostatni dzień włącznie”), ale w panelu mają mylący status.
- Codzienny cron `expire-promotions` (03:00) ustawia status wygasłych ofert. Po wdrożeniu `bb19687` tworzy też powiadomienia `PROMOTION_EXPIRED` w panelu.
- Zdecyduj dla każdej: **pozwolić wygasnąć** (oferta zostanie jako „zakończona” przez 90 dni z `index`, potem `noindex`) czy **przedłużyć**, jeśli bank wydłużył promocję (skrypt `scripts/extend-promotion.ts`). Cron nie robi tego za Ciebie.
- Szczególnie dotyczy to ofert dobrze znanych z linków partnerskich: wygasła oferta z działającym linkiem partnerskim nie może zachęcać do zapisu (strona pokazuje baner „Zakończona” i wyłącza przycisk).

### 5.6 Test builda produkcyjnego i ręczna ścieżka

- [ ] **`next build` przed wdrożeniem.** Na Windows: `npm run build:win` (zwykły `npm run build` na Linuksie w CI; skrypt `build` musi pozostać prostym `next build`, CI to sprawdza). Budowa produkcyjna w osobnej kopii przechodziła po każdej fali (przy fali C: 86 stron; po fali E zbuduj ją ponownie). Ostrzeżenie z doświadczeń: błędy trybu produkcyjnego (np. 500 na nieistniejącym adresie przy ISR na trasie dynamicznej) **nie ujawniają się w `npm run dev`**, więc zawsze buduj i uruchom `npm start` przed wdrożeniem. Nie uruchamiaj budowania w katalogu repozytorium, gdy działa serwer deweloperski.
- [ ] `npx.cmd tsc --noEmit`, `npm run lint`, `npm test` (patrz sekcja 8).
- [ ] Po wdrożeniu: `/sitemap.xml` (adresy z `https://bankmiplaci.pl`, nie localhost), `/robots.txt`, źródło strony głównej (canonical).

**Ręczna ścieżka testowa (10 kroków, ok. 15 minut, najlepiej na telefonie i na komputerze, w jasnym i ciemnym motywie):**

1. Wejdź na stronę główną: czy widać hero, sekcję „Polecane” **z paskiem ujawnienia nad listą**, kończące się promocje, przełącznik motywu w nagłówku?
2. Przełącz motyw (Jasny / Ciemny / Automatycznie), odśwież stronę: motyw się trzyma, bez „mignięcia” złego motywu.
3. Przejdź do `/promocje`: zmień sortowanie (Polecane / Najlepsza ocena / Najwyższa premia), dodaj filtr banku, otwórz filtry na telefonie (arkusz), wyczyść filtr. Czy opis sortowania „Polecane (z wynagrodzeniem)” i pełne ujawnienie są widoczne?
4. Otwórz stronę oferty: kwota, „W skrócie”, warunki krok po kroku, opłaty (brak „0 zł” tam, gdzie powinno być „Brak danych” lub „od 0 zł”), data weryfikacji, termin „Ważna do…”.
5. Kliknij „Przejdź do promocji” (przycisk z dopiskiem „Link partnerski” pod spodem): czy otwiera się strona banku w nowej karcie i czy w panelu admina zapisało się kliknięcie (`/out/[slug]`)?
6. Kliknij „Zaloguj” z dowolnej strony: otwiera się okno logowania; zamknij je klawiszem Esc, fokus wraca na przycisk.
7. Załóż testowe konto: bez zaznaczenia zgody na regulamin formularz musi odmówić; po zaznaczeniu konto powstaje. Zaloguj się, wyloguj, spróbuj „Zapomniałem hasła” (e-mail dochodzi, link działa).
8. Na zalogowanym koncie: „Dodaj do ściągi” z oferty, odhacz krok, sprawdź `/konto` (ściąga, terminy, licznik).
9. `/porownaj` (zaznacz 2–3 oferty, tabela z przyklejoną kolumną, przycisk z dopiskiem „Link partnerski”) i `/quiz` (kilka różnych odpowiedzi daje różne wyniki).
10. Wejdź na nieistniejące adresy (`/promocje/zzz`, `/blog/zzz`) – 404 z naszej strony błędu; sprawdź `/banki`, `/konta-osobiste-z-premia`, `/promocje/konczace-sie`, `/jak-zarabiamy` (sekcja o kolejności „Polecane”), stopkę (dane wydawcy), `/regulamin` (treść bez zmian), a w narzędziu deweloperskim że w kodzie strony nie ma pola z wynagrodzeniem partnerskim.

---

## 6. Czego NIE zrobiono (świadomie)

- **WP-17: sesja poza layoutem → cache/ISR.** Dziś layout czyta ciasteczko sesji, więc **wszystkie strony są dynamiczne (bez cache CDN)**. Strony działają poprawnie, ale wolniej niż mogłyby. Przeniesienie sesji poza layout (i dopiero potem ISR) to osobna, ryzykowna faza; przy okazji nauczyliśmy się, że eksporty ISR na trasach pod layoutem czytającym ciasteczka powodują błąd 500 w produkcji.
- **Faza 2 stron SEO**: archiwum ofert (`/promocje/archiwum`), „najłatwiejsze promocje”, „bez opłat”, „dla nowych klientów”. W rejestrze tras (`src/lib/seo/routes.ts`) są zapisane z flagą `live: false`, żeby nie trafiły do sitemapy ani nawigacji, dopóki nie powstaną.
- **Widok tabeli listy ofert** (przełącznik Karty / Tabela w `?widok=`). Jest tylko tabela na `/porownaj`.
- **Rejestracja zdarzeń i analityka**: nie dodano nowych pikseli ani narzędzi analitycznych (to wymagałoby banera zgód i opinii prawnika).
- **Redesign panelu admina** (`/admin` zostaje w wyglądzie v1).
- **`EarningsCounter` (licznik zarobków) tylko na `/konto`**, jak w v1.
- **Obrazy OG per strona**: jest jeden wspólny obrazek serwisu.
- **Rzeczywiste artykuły bloga**: dostarczono szablon, kategorie i renderer, treści redakcyjne to osobny strumień (w lokalnej bazie 0 artykułów).
- **Teksty prawne**: nie zmieniono (propozycje w dokumencie 06 czekają na prawnika).
- **Pola `requiresReferralLink` i `benefitType`**, o których mowa w planach (`04`, `03`): nie sprawdzałem, czy powstały w schemacie; zakładaj, że ich nie ma (w schemacie `prisma/schema.prisma` dochodzą tylko 3 nowe pola: `affiliateCommissionCents`, `termsAcceptedAt`, `termsVersion`). Dopóki ich nie ma, strona nie twierdzi, że warunki są „identyczne” bez linku.
- **Nie przetestowano w przeglądarce rzeczywistych urządzeń**; przeglądy wizualne były w headless Chromium (Playwright) i na serwerze deweloperskim.
- **Nie wykonywano żadnych zapisów do bazy ani migracji w ramach tego dokumentu.**

---

## 7. Decyzje podjęte po drodze, o których powinieneś wiedzieć

1. **Wynagrodzenie partnerskie NIE jest ukryte.** Chciałeś, żeby ocena faworyzowała lepiej płacące oferty i żeby tego nie opisywać. Zrobiłem inaczej i uzasadniam: nieujawniony, opłacony ranking to wprowadzanie w błąd (nieuczciwa praktyka rynkowa; UOKiK), a wymóg przejrzystości głównych parametrów rankingu wynika też z regulacji Omnibus. Dlatego: wynagrodzenie wpływa **tylko** na kolejność „Polecane”, nie na ocenę serwisu, a ten wpływ jest ujawniony w trzech miejscach (pasek nad listą, opis przy kontrolce sortowania, `/jak-zarabiamy#polecane`). Jeśli się z tym nie zgadzasz, to jest decyzja do omówienia z prawnikiem, nie do cichego usunięcia tekstu.
2. **Ocena serwisu jest liczona bez wynagrodzenia** (`ratings.ts`). To zasada chroniona testami; zdanie „Wysokość prowizji nie jest składnikiem oceny” jest na `/metodologia`.
3. **Wynagrodzenie działa silniej niż różnice w ocenach** (`src/lib/recommended.ts`): współczynnik od 0,6 do 1,0 rozciąga się na 0,4 skali, a oceny aktualnych ofert mieszczą się między 8,3 a 9,8 (wg notatek z przeglądu). Oferta o niższej ocenie może więc wyprzedzić lepszą. Wczesna wersja ujawnienia mówiła „m.in. wynagrodzenie” i to zaniżało wpływ, więc po recenzjach wszystkie teksty (pasek, znacznik, FAQ, `/jak-zarabiamy`, `/metodologia`, `/o-nas`) mówią wprost, że oferta o niższej ocenie może znaleźć się wyżej. Ocena i wynagrodzenie są porównywane w obrębie tego samego typu konta (premia za konto firmowe jest zwykle znacznie wyższa niż za osobiste, wg komentarza w kodzie).
4. **Brak danych o wynagrodzeniu = neutralnie** (nie szkodzi, nie pomaga): oferty bez wpisanej prowizji dostają współczynnik 0,8.
5. **Wynagrodzenie nigdy nie jest widoczne publicznie**, nawet dla zalogowanych: nie ma go w HTML, danych komponentów, JSON ani odpowiedziach serwera.
6. **Stopka pokazuje dane wydawcy** (osoba, adres, NIP, REGON): wymóg przejrzystości serwisu, dane już publiczne w regulaminie.
7. **Stopka zastępuje wcześniejsze sformułowanie** „nie jest oficjalnym partnerem żadnego z banków” (nieprawdziwe wobec programu partnerskiego) zdaniem, że serwis nie jest bankiem ani oficjalnym przedstawicielem banków i że część linków to linki partnerskie.
8. **Trudność oferty jest neutralna** (ikona i słowo), żeby „Trudna” nie wyglądała jak błąd; kolor ma jedną rolę: teal = akcja, bursztyn = nagroda/termin, ceglasty = błąd/zakończona.
9. **Brak danych = „Brak danych”, nigdy „0 zł”**; zero zmyślonych faktów (żadnych wymyślonych liczb użytkowników, opinii, gwiazdek, logotypów partnerów ani ekspertów).
10. **Bez sztucznej presji**: brak odliczań, „ostatnie miejsca”, migających znaczników. Kolor ostrzegawczy przy terminie tylko dla ≤14 dni, czerwony ≤3 dni.
11. **System płaski**: karty bez cienia i uniesienia na hoverze (tylko zmiana ramki), wszystko na cienkich liniach.
12. **Teksty prawne bez zmian**: zmieniłem tylko układ i dostępność. Każda zmiana treści prawnej wymaga prawnika (dokument 06).
13. **Nie przenoszę logiki**: logowanie/modal, `/out`, ściąga z odblokowywaniem miesięcy, karencja, filtry, komentarze i admin zostały nietknięte (poza opisanymi wyżej poprawkami błędów interfejsu).
14. **Obowiązkowa zgoda na regulamin przy rejestracji** (nie blokuje istniejących kont): nowe konta mają zapisaną datę i wersję zgody; stare mają „brak zapisu”.
15. **Odroczenie WP-17** (cache/ISR): świadomie, żeby nie ryzykować błędów produkcyjnych; patrz sekcja 6.

---

## 8. Jak uruchomić i sprawdzić lokalnie

Wymagania: Node.js, lokalny PostgreSQL pod adresem z `.env` (`DATABASE_URL` wskazuje `localhost`; **nigdy nie wpisuj tam adresu produkcyjnej bazy**), zainstalowane zależności (`npm ci`). W PowerShell używaj `npx.cmd` zamiast `npx`.

```bash
npm run dev            # serwer deweloperski: http://localhost:3000
npm test               # wszystkie testy jednostkowe (tsx --test tests/*.test.ts tests/*.test.tsx)
npm run lint           # ESLint dla katalogu src
npx.cmd tsc --noEmit   # sprawdzenie typów (przed tym usuń katalog .next/types, jeśli istnieje)
npm run build:win      # lokalny build produkcyjny na Windows (osobna kopia, nie przy działającym dev!)
npm run audit:fees     # tylko odczyt: lista ofert z niezweryfikowanymi opłatami
```

Stan testów przy ostatnim uruchomieniu w dniu pisania (2026-10-10): **854 testy, wszystkie przechodzą, 0 błędów** (na początku fali E było 800; liczba rośnie wraz z nowymi bramkami jakości, np. `tests/ui-tokens.test.ts`, `tests/contrast.test.ts`). `tsc` i ESLint były czyste na początku fali E (nie uruchamiałem ich ponownie przy pisaniu tego dokumentu).

Dodatkowo:

```bash
npm run test:db        # testy na prawdziwej bazie testowej (wymaga osobnej, pustej bazy; patrz CI)
```

**Audyt dostępności** (jeśli dostępny): `npm run audit:a11y` – skrypt `scripts/a11y-audit.mjs` (Playwright + axe) jest dodawany w fali E przez osobnego wykonawcę. W chwili pisania **pliku `scripts/a11y-audit.mjs` jeszcze nie ma i nie ma wpisu `audit:a11y` w `package.json`**, więc polecenia nie uruchomisz; sprawdź `ls scripts/a11y-audit.mjs` i `grep audit:a11y package.json`. Jeśli skrypt się pojawił, wymaga działającego `npm run dev` na porcie 3000.

CI (GitHub Actions, `.github/workflows/ci.yml`) po wypchnięciu uruchamia: audyt zależności, zastosowanie wszystkich migracji na pustej bazie, `tsc`, ESLint, testy, testy bazy, build, kontrole w Chromium i test dymny. Patrz uwaga w punkcie 5.0 o skryptach `ci-visual.js` i `ci-smoke.js`.

---

## 9. Dodatek: gdzie co leży

| Dokument / plik | Zawartość |
|---|---|
| `docs/redesign-v2.md` | Ten przewodnik |
| `docs/redesign-v2/00-direction.md` | Kierunek i decyzje syntezy („Papier i tusz”) |
| `docs/redesign-v2/01-design-spec.md` | Tokeny kolorów, typografia, komponenty, zakazane wzorce |
| `docs/redesign-v2/02-layout-spec.md` | Układy stron |
| `docs/redesign-v2/03-content-and-seo-plan.md` | Plan SEO i treści, poprawki tekstów (przed → po) |
| `docs/redesign-v2/04-trust-and-disclosure-plan.md` | Zaufanie, ujawnienia, brzmienia, prywatność |
| `docs/redesign-v2/05-work-packages.json` | Pakiety WP-01…WP-18, zależności, własność plików |
| `docs/redesign-v2/06-legal-text-proposals.md` | Propozycje zmian tekstów prawnych (NIE opublikowane) |
| `docs/etap1-deployment.md` | Wzór procedury wdrożenia migracji i wycofania z Etapu 1 |
| `docs/ebroker-daily-automation.md` | Opis automatyki eBroker (z `bb19687`) |
| `src/lib/recommended.ts` | Wzór sortowania „Polecane” |
| `src/lib/disclosureCopy.ts` | Jedno źródło treści ujawnień |
| `src/lib/feeModel.ts` | Jeden model opłat |
| `src/lib/seo/` | Biblioteka SEO (tytuły, JSON-LD, sitemap, flagi tras w `routes.ts`) |
| `src/lib/publisher.ts` | Dane wydawcy w stopce |
| `src/lib/navigation.ts` | Jedna lista linków nagłówka/stopki |
| `prisma/migrations/` | Migracje (ostatnia: `20261008120000_user_terms_acceptance`) |

Szybkie polecenia do zorientowania się:

```bash
git log --oneline v1-pre-redesign..HEAD          # co dokładnie jest w redesignie
git diff --stat v1-pre-redesign HEAD             # skala zmian względem starej wersji
git tag -l "v*"                                  # tagi
git rev-parse --short v2-m3-pages                # gdzie dziś wskazuje tag końcowy
git branch -vv                                   # relacja lokalnych gałęzi do origin
```
