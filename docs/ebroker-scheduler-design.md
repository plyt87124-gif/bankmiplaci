# Projekt: scheduler kolektora katalogu XML eBroker (Windows)

Status: **PROPOZYCJA DO PRZEGLĄDU**, rewizja v2 z 4.10.2026. Nic nie wdrożono, nie
zarejestrowano ani nie uruchomiono; polecenia i liczby to przykłady, nie fakty.
Interfejs oparty na `scripts/ebroker_catalog.py`, `docs/ebroker-catalog-pilot.md`
i przyjętym `scripts/ebroker_run_lock.py` (kod locka pozostaje bez zmian).
Walidator i testy zależnych modułów są w odbiorze (**NOT_RUN**); implementacja
schedulera czeka na ich akceptację i osobną zgodę.

## Cel i priorytety

Scheduler służy rzetelności danych o ofertach (sygnały do przeglądu), a przez to
kwalifikującym się założeniom kont z linków partnerskich. Kolejność: rzetelność
warunków, pomoc klientowi i monitoring → przewagi wobec konkurencji → SEO → filmy
organiczne → płatne reklamy. Feed nie zawiera dat, edycji, opłat ani statusu
afiliacji (`UNKNOWN`) — do czasu oficjalnej dokumentacji XML scheduler ich nie
weryfikuje. Błąd, brak feedu ani `MISSING_FROM_CATALOG` **nigdy** nie dają
`EXPIRED` ani zmiany produkcji. Pilot mBank `oid` 13870 — osobno, po przeglądzie.

## Najważniejsza decyzja

**Harmonogram zadań Windows + cienki wrapper Python (stdlib) z niemutowalnymi
generacjami stanu i jednym wskaźnikiem `current.json`.** Wrapper nie modyfikuje
kolektora: uruchamia go jako podproces w `staging\<runId>\`, waliduje wynik,
buduje kompletną generację `generations\<runId>\` i dopiero wtedy przełącza
wskaźnik. Jedyny punkt promocji = jedno `os.replace` pliku `current.json`.
Bez usług, baz, kolejek zewnętrznych.

Powód zmiany względem v1: dwa osobne `os.replace` (porównanie, potem snapshot)
nie tworzą wspólnej transakcji — awaria pomiędzy nimi albo przed zapisem
`PROMOTED` zostawiała niespójny `state\` i gubiła kolejkę propozycji.

## Fakty z kodu i dokumentacji

- CLI kolektora: `--state-dir` (wymagany, poza repo), `--url`, `--from-file`,
  `--dry-run`, `--timeout` (domyślnie 20 s), `--max-bytes` (2 MiB). `run()` zwraca
  `0` lub `2`; kolektor zapisuje `comparisons\<czas>-<sha8>.json` →
  `latest-comparison.json` → `latest-snapshot.json` (każdy tmp + fsync + `os.replace`).
  Sam nie ma locka, retry ani wykrywania „za małego” feedu.
- Kod `2` obejmuje `CatalogError`, ale argparse też kończy kodem `2`. Kod `2` +
  tekst stderr **nie** daje wiarygodnej klasyfikacji wszystkich błędów (sieć vs XML
  vs lokalny zapis vs nieobsłużony wyjątek) ani gwarancji sprzątnięcia plików tmp
  w `--state-dir`. Dlatego wrapper nie ufa stanowi katalogu staging po błędzie.
- Lock (`scripts/ebroker_run_lock.py`): `acquire_lock(lock_dir, owner_token)` =
  atomowe `os.mkdir(lock_dir)` + plik `owner` (`O_CREAT|O_EXCL`) z samym tokenem;
  `release_lock(lock_dir, owner_token)` usuwa wyłącznie kompletny lock z tym samym
  tokenem. Brak PID/czasu w rekordzie i **brak przejmowania** (takeover) —
  pozostawiony lock usuwa człowiek. Wyjątki: `LockBusyError`, `LockIOError`,
  `LockOwnerWriteError(lock_dir_remains)`, `LockReleaseRefusedError`,
  `LockOwnershipMismatchError`, `InvalidOwnerTokenError`. Moduł zakłada lokalny
  filesystem i współpracujące procesy.
- `os.replace` (docs Python 3.12, `os`): zastępuje istniejący plik docelowy, może
  zawieść między różnymi filesystemami; atomowość udanej operacji jest opisana
  jako wymóg POSIX. Dokumentacja nie daje gwarancji trwałości po utracie zasilania
  ani wprost atomowości na Windows — **ten projekt ich nie deklaruje** bez testów
  na docelowym hoście. `os.kill(pid, 0)` na Windows kończy proces — nie używać.

## Układ stanu (poza repo i katalogiem web, jeden lokalny wolumin)

Root, np. `%LOCALAPPDATA%\bmp-ebroker\` (wrapper odrzuca ścieżki w repo, `public\`,
`.next\`, dyskach sieciowych). `staging\` i `generations\` **muszą** leżeć na tym
samym lokalnym filesystemie co `current.json` (sprawdzenie `st_dev` przy starcie).

```
run.lock\owner                      lock z ebroker_run_lock (katalog + owner)
current.json                        JEDYNY wskaźnik promowanej generacji
generations\<runId>\snapshot.json   niemutowalne po zapisie manifestu
generations\<runId>\comparison.json
generations\<runId>\manifest.json   zapisywany OSTATNI
staging\<runId>\                    robocze, nigdy nie czytane jako stan
quarantine\<runId>\                 SUSPECT_INCOMPLETE / do analizy
runs\<runId>.json                   dziennik pomocniczy (diagnostyka, nie źródło prawdy)
proposals\pending\<eventKey>.json   proposals\reviewed\<eventKey>.json
queue-done\<runId>.json             znacznik: wszystkie propozycje runId zapisane
outbox\<runId>.txt                  delivered\<runId>.json
seen-events.json                    indeks pochodny, odtwarzalny z proposals\
```

`current.json`: `{"pointerVersion":1,"schemaVersion":…,"runId":…,`
`"manifestSha256":…,"snapshotSha256":…,"comparisonSha256":…,"parentRunId":…}`.
`manifest.json`: `runId`, `parentRunId`, `parentSnapshotSha256` (lub `null` dla
baseline), `schemaVersion`, sha256 i rozmiar `snapshot.json` i `comparison.json`,
liczba eventów.

**Czytelnik** (wrapper, raport, przyszły walidator): czyta `current.json` **raz**,
potem wyłącznie `generations\<runId>\` z tego odczytu; sprawdza sha256 manifestu,
obu plików i `schemaVersion`. Dowolna niezgodność → `STATE_INVALID` (fail-closed),
nigdy baseline ani „najnowszy katalog z listingu”.

## Przebieg jednego uruchomienia

1. **Lock.** `owner_token = secrets.token_hex(16)` (spełnia regex modułu),
   `acquire_lock(root\run.lock, owner_token)`. `LockBusyError` → `LOCKED`, wyjście
   bez przejmowania. `LockOwnerWriteError` z `lock_dir_remains=True` →
   `LOCK_INCOMPLETE` (ręczne usunięcie). `LockIOError` → `LOCAL_WRITE_FAILED`.
   Opcjonalnie Task Scheduler „nie uruchamiaj nowego wystąpienia” (dodatkowo, nie
   zamiast locka). Wiek locka można najwyżej raportować z mtime katalogu jako
   diagnostykę — bez automatycznego usuwania.
2. **Odczyt stanu** (sekcja „Recovery”). `STATE_INVALID` → koniec bez fetch.
3. **Dokończenie poprzedniej generacji:** jeśli wskazywany `runId` nie ma
   `queue-done\<runId>.json` lub `outbox\<runId>.txt` → dokończ idempotentnie
   (kroki 9–10) **przed** nowym pobraniem. Nowy fetch startuje dopiero, gdy kolejka
   aktualnej generacji jest kompletna — dzięki temu przełączenie wskaźnika nie
   może „przeskoczyć” niezakolejkowanych eventów.
4. **Staging.** Nowy `runId` (np. czas UTC + 8 znaków tokenu, bez znaków spoza
   `[A-Za-z0-9._-]`). `staging\<runId>\` musi nie istnieć (`os.mkdir`, bez
   `exist_ok`). Kopia `snapshot.json` z bieżącej generacji jako
   `latest-snapshot.json`, weryfikacja sha256 kopii; baseline → pusty katalog.
5. **Fetch** — podproces:
   `py -3 scripts\ebroker_catalog.py --state-dir <staging> --timeout 20`
   (`subprocess.run(..., timeout=…)`, wartość do ustalenia). Klasyfikacja w sekcji
   „Błędy”. Każdy niezerowy wynik → staging porzucony (nie promowany).
6. **Walidacja wyniku:** oba pliki JSON parsują się, `schemaVersion` oczekiwany,
   porównanie odnosi się do skopiowanego snapshotu rodzica. Inaczej `FEED_INVALID`
   lub `STATE_INVALID` (jeśli to problem stanu).
7. **Kontrola kompletności** (przykładowe progi, **BRAK FAKTU** o zmienności
   feedu, do kalibracji): np. spadek `offerCount` > 30%, `missing` > 20% lub > 15
   ofert, `byteSize` < 50% poprzedniego → `SUSPECT_INCOMPLETE`: staging →
   `quarantine\`, brak promocji i propozycji.
8. **Budowa generacji i promocja.**
   a. `os.mkdir(generations\<runId>)`; zapis `snapshot.json`, `comparison.json`
      (kopie ze staging; tmp + fsync + `os.replace` w obrębie katalogu generacji),
      na końcu `manifest.json`. Ponowny odczyt i weryfikacja hashy.
   b. Pod lockiem ponowny odczyt `current.json`: jego `runId` musi równać się
      `parentRunId` (lub brak wskaźnika dla dozwolonego baseline). Inaczej
      `STATE_INVALID`, bez promocji.
   c. `current.json.<runId>.tmp` (fsync) → `os.replace(…, current.json)`. **To jest
      jedyny punkt promocji.** Poprzednia generacja nie jest kasowana.
   d. Wpis `PROMOTED` w `runs\<runId>.json` — pomocniczy; jego brak nie zmienia stanu.
9. **Kolejka propozycji** (z `generations\<runId>\comparison.json`, nie ze staging):
   dla każdego eventu, w kolejności `eventKey`: zapis propozycji (sekcja niżej),
   potem aktualizacja `seen-events.json`. Po wszystkich → `queue-done\<runId>.json`.
   Brak automatycznych zmian w danych serwisu; status `PENDING_REVIEW`.
10. **Raport:** `outbox\<runId>.txt` deterministycznie z generacji (eventy
    posortowane po `eventKey`, bez pełnych linków afiliacyjnych), tmp + `os.replace`;
    ponowny zapis daje identyczną treść. Dostarczenie to osobny krok; sukces →
    `delivered\<runId>.json`. Błąd dostarczenia → `REPORT_PENDING`, nie cofa promocji.
11. **Sprzątanie** `staging\<runId>\` (po promocji lub porzuceniu) — błąd sprzątania
    tylko raportowany, nie zmienia statusu stanu.
12. **Zwolnienie:** `release_lock(root\run.lock, owner_token)` w `finally`.
    `LockReleaseRefusedError`/`LockOwnershipMismatchError` → dodatkowy status
    `LOCK_RELEASE_FAILED` obok statusu przebiegu (nie maskuje go); lock zostaje,
    kolejne przebiegi dostają `LOCKED` do ręcznej interwencji.

## Recovery (start każdego przebiegu, pod lockiem)

Źródłem prawdy jest **wskaźnik**, nie dziennik `runs\`.

- `current.json` poprawny i generacja kompletna → stan = ta generacja. Jeśli brak
  `queue-done`/`outbox` dla jej `runId` → dokończ (krok 3), także gdy `runs\<runId>.json`
  nie ma `PROMOTED` (awaria między 8c a 8d).
- `current.json` uszkodzony, wskazuje brakującą/niekompletną generację lub hash
  się nie zgadza → `STATE_INVALID`, brak fetch, brak baseline; ręczna decyzja.
- Brak `current.json`: baseline **tylko** gdy root nie ma żadnej historii
  (`generations\`, `runs\`, `proposals\`, `outbox\`, `delivered\`, `quarantine\`
  puste lub nieistniejące, brak legacy `state\latest-snapshot.json` z pilota).
  Jakakolwiek historia → `STATE_INVALID` (np. ręczny import pilota osobną decyzją).
- `staging\*` i generacje bez wskaźnika (awaria przed 8c) nie wpływają na stan:
  nie są promowane przy recovery, oznaczane `ABANDONED` w dzienniku; nowy przebieg
  pobiera od nowa. Niezpromowaną generację wolno usunąć dopiero, gdy nie jest
  wskazywana i nie jest rodzicem bieżącej.
- **Rollback:** ręczne przełączenie `current.json` na poprzedni `runId` (ten sam
  mechanizm tmp + `os.replace`, z walidacją generacji). Generacje są zachowywane;
  retencja (ile ostatnich) do ustalenia, nigdy nie usuwa generacji bieżącej ani jej
  rodzica, a kasowanie jest osobnym krokiem, nie częścią promocji.
- Zmiana `schemaVersion` → stop i ręczna decyzja, nie cichy baseline.

## Propozycje: klucz, serializacja, dedup

- `eventKey = sha256(canonical(event_id))`, gdzie `event_id` =
  `{"v":1,"type","oid","previousSha256","sha256","changedFields",`
  `"parentSnapshotSha256"}`; brakujące hashe = `null`; `changedFields` = lista
  unikalnych nazw pól posortowana leksykograficznie (kod punktów Unicode).
  Nazwy pól eventu do potwierdzenia z `ebroker_catalog.py` przed implementacją.
- `canonical` = `json.dumps(obj, sort_keys=True, separators=(",", ":"),
  ensure_ascii=False).encode("utf-8")`; bez floatów (tylko str/int/bool/null/listy).
- `parentSnapshotSha256` w kluczu: replay tej samej generacji daje ten sam klucz,
  a legalne powtórzenie zmiany (A→B, B→A, A→B) w innej generacji — nowy klucz.
- Zapis: jeśli `proposals\reviewed\<eventKey>.json` istnieje → pomiń. Jeśli
  `pending\<eventKey>.json` istnieje i ma identyczną treść kanoniczną → pomiń;
  inna treść → `PROPOSAL_CONFLICT`, stop bez nadpisania. Inaczej tmp (`O_EXCL`) +
  fsync + `os.replace`. Treść propozycji deterministyczna (bez czasu zapisu;
  czas jest w `runs\`), więc replay jest bajtowo identyczny.
- `seen-events.json` aktualizowany **po** zapisie propozycji i jest tylko indeksem:
  dedup opiera się na istnieniu pliku propozycji. Przy rozbieżności indeks jest
  odbudowywany z `proposals\`; nigdy nie pomija eventu, którego pliku nie ma.
- Dostarczenie raportu jest co najwyżej „at-least-once” (awaria po wysłaniu, przed
  `delivered\`) — odbiorca deduplikuje po `runId`. Na start kanał = tylko plik.

## Błędy i retry

| Klasa | Przykłady | Status | Retry |
|---|---|---|---|
| Transient fetch (potwierdzona) | timeout, błąd połączenia, HTTP 5xx | `FEED_UNAVAILABLE` | tak, ograniczone (np. 3 próby, przykładowe odstępy) |
| Feed niepoprawny | XML, rozmiar, HTTP 4xx | `FEED_INVALID` | nie |
| Niesklasyfikowany błąd podprocesu | kod 1, traceback, kod 2 bez rozpoznanego wzorca, timeout podprocesu | `FETCH_FAILED_UNCLASSIFIED` | nie |
| Lokalny zapis (wrapper) | `OSError` przy staging/generacji/wskaźniku/propozycji, pełny dysk | `LOCAL_WRITE_FAILED` | **nie** — bez ponawiania całego etapu |

- Retry dotyczy wyłącznie samego fetch i tylko klasy potwierdzonej. Każda próba
  w nowym, pustym `staging\<runId>-<n>\`; poprzedni staging porzucony.
- Wiarygodna klasyfikacja wymaga maszynowo czytelnej klasy błędu od kolektora
  (np. osobny kod wyjścia lub JSON na stderr) — **otwarta zmiana interfejsu**, poza
  tym dokumentem. Do tego czasu niejasne przypadki = `FETCH_FAILED_UNCLASSIFIED`.
- `LOCAL_WRITE_FAILED` po 8c (propozycje/outbox) nie cofa promocji; dokończenie
  nastąpi w kroku 3 następnego przebiegu.

## Statusy końcowe przebiegu

`OK`, `OK_BASELINE`, `FEED_UNAVAILABLE`, `FEED_INVALID`, `FETCH_FAILED_UNCLASSIFIED`,
`SUSPECT_INCOMPLETE`, `LOCAL_WRITE_FAILED`, `STATE_INVALID`, `PROPOSAL_CONFLICT`,
`LOCKED`, `LOCK_INCOMPLETE`, `REPORT_PENDING` (+ ewentualnie `LOCK_RELEASE_FAILED`).
Żaden nie zmienia produkcji.

## Przykład rejestracji (NIE wykonywać; wymaga osobnej zgody)

```
schtasks /Create /TN "bmp\ebroker-catalog" /SC DAILY /ST <GG:MM> ^
  /TR "py -3 <repo>\scripts\ebroker_scheduler.py --root %LOCALAPPDATA%\bmp-ebroker"
```
Częstotliwość i godzina to symbole zastępcze — dozwolona częstotliwość odpytywania
to **BRAK FAKTU**. Ustawienia: MultipleInstances=IgnoreNew, limit czasu wykonania
(do ustalenia), StartWhenAvailable, bez najwyższych uprawnień. Hosta/autostartu/
uprawnień workera nie zmieniamy.

## Brakujące fakty i blokady

Dozwolona częstotliwość i limity eBroker; typowa zmienność liczby ofert (progi);
maszynowa klasa błędu kolektora; nazwy pól eventu; kanał dostarczenia raportu;
wersja Pythona na hoście; zachowanie `os.replace`/fsync na docelowym NTFS przy
awarii zasilania (niezweryfikowane); oficjalna dokumentacja XML. Akceptacja
walidatora i testów modułów zależnych (NOT_RUN).

## Następny mały krok (po akceptacji, osobna zgoda)

`scripts/ebroker_scheduler.py`: integracja `acquire_lock`/`release_lock` bez zmian
w module locka + generacje/wskaźnik + recovery, bez fetch sieciowego (fetcher
wstrzykiwany) i bez rejestracji zadania.

## Kryteria testów (offline, fetcher wstrzykiwany; status: NOT_RUN)

- **Crash po każdym kroku** (wstrzyknięty wyjątek/przerwanie po 1, 4, 5, 6, 7, 8a,
  przed i po 8c, po 8d, w trakcie i po 9, po 10, w 12): następny przebieg ma
  poprawny stan; przed 8c wskaźnik = stara generacja, po 8c = nowa; zero utraconych
  i zero zdublowanych propozycji; outbox identyczny bajtowo.
- **Wskaźnik bez journal:** awaria między 8c a 8d → kolejka dokończona z generacji.
- **Rollback:** przełączenie wskaźnika na poprzedni `runId` → czytelnicy widzą
  stary stan; poprzednia generacja nie została usunięta przez promocję.
- **Fail-closed:** uszkodzony/ucięty `current.json`, zły hash, brak pliku w
  generacji, wskaźnik na nieistniejący `runId` → `STATE_INVALID`, brak fetch,
  brak baseline. Brak wskaźnika przy istniejącej historii → `STATE_INVALID`.
- **Lock:** dwa procesy → jeden `LOCKED`; obcy token nie zwalnia; pozostawiony
  lock blokuje bez przejęcia; błąd release raportowany obok statusu przebiegu.
- **Dedup/replay:** dwukrotne przetworzenie tej samej generacji → te same pliki;
  inna kolejność `changedFields` → ten sam klucz; A→B→A→B → trzy różne klucze;
  `seen-events.json` usunięty/uszkodzony → odbudowa, brak duplikatów.
- **Błędy:** transient → ograniczone retry, potem `FEED_UNAVAILABLE`, stan bez
  zmian, brak `EXPIRED`; ucięty XML → `FEED_INVALID`; traceback/kod 1 →
  `FETCH_FAILED_UNCLASSIFIED` bez retry; pełny dysk przy generacji/wskaźniku →
  `LOCAL_WRITE_FAILED`, wskaźnik nienaruszony, brak ponowienia etapu.
- **Kompletność:** poprawny XML z 10 ofertami → `SUSPECT_INCOMPLETE`, kwarantanna,
  brak eventów `MISSING`.
- **Raport:** błąd kanału → `REPORT_PENDING`, promocja zachowana, jedno `delivered`.
- **Baseline:** pusty root → 0 propozycji; drugi identyczny przebieg → 0 eventów.
- **Filesystem:** staging na innym woluminie niż root → odmowa startu.
