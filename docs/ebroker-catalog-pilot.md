# Pilot: katalog XML eBroker — kolektor jednorazowego odczytu

Stan na 3 października 2026. Narzędzie operacyjne do ręcznego uruchamiania,
a nie część aplikacji Next.js. Nie ma schedulera ani pełnego monitoringu.

## Wymagania

- **Python 3** (zalecany 3.9+; tylko biblioteka standardowa). Nie trzeba
  niczego instalować, a `package.json` i `package-lock.json` pozostają bez zmian.
  Python wybrano celowo: parsowanie XML bez dodatkowych zależności npm.
- Dostęp do sieci tylko przy zwykłym uruchomieniu bez `--from-file`.

## Źródło

Oficjalny feed partnera (eBroker → Narzędzia → Plik XML):
`https://bankmiplaci.ebrokerpartner.pl/xml-file`. Feed jest publiczny, więc
narzędzie nie używa cookies ani logowania. 3.10.2026 odpowiedź miała
`application/xml`, 92 623 B, root `<offers>` i 113 elementów `<offer>`.
Pola: `oid, name, institution, logo, description, url, category, subcategory`.
Pilotowa oferta to mBank, `oid` 13870.

**Schemat nie zawiera dat zapisów ani edycji, taryf, opłat ani statusów.**
W snapshotach pola te mają zawsze wartość `UNKNOWN` (`campaignTerms`).
Narzędzie nie tworzy `CampaignSnapshot` i nie uzupełnia warunków samodzielnie.

## Uruchomienie

Katalog stanu (`--state-dir`) jest obowiązkowy i musi leżeć **poza
repozytorium**. Ścieżki wewnątrz projektu są odrzucane, także `data/` z
`data/new-promotions.json`, `prisma/` i katalogi buildów. Nie używaj też
katalogów produkcyjnych.

```sh
# suchy przebieg: pobiera, waliduje i porównuje, ale niczego nie zapisuje
python3 scripts/ebroker_catalog.py --state-dir "$HOME/bmp-ebroker-state" --dry-run

# zwykły odczyt: zapisuje snapshot i porównanie
python3 scripts/ebroker_catalog.py --state-dir "$HOME/bmp-ebroker-state"

# analiza zapisanego wcześniej pliku, bez sieci
python3 scripts/ebroker_catalog.py --state-dir "$HOME/bmp-ebroker-state" --from-file feed.xml --dry-run
```

W systemie Windows zamiast `python3` użyj `py -3` lub `python`.
Dodatkowe opcje: `--url` (tylko `https://`), `--timeout` (łączny limit, domyślnie
20 s) i `--max-bytes` (domyślnie 2 MiB).

Kod wyjścia `0` oznacza sukces. Kod `2` oznacza błąd: nic nie zapisano, a
ostatnia poprawna kopia pozostaje bez zmian.

## Co robi

1. Wykonuje jeden GET feedu: bez cookies, bez danych logowania i bez
   przekierowań. Sprawdza status 200, typ `xml`, limit rozmiaru i czasu.
   **Nie pobiera ani nie otwiera** linków `url` ani `logo` z ofert.
2. Parsuje XML przez `xml.etree.ElementTree`. Odrzuca `DOCTYPE`/`ENTITY`, inny
   root niż `<offers>`, nieznane elementy pod rootem, brakujące, puste lub
   niepoprawne `oid`, duplikaty `oid` i pusty katalog. Brakujące lub puste
   `name` jest zachowywane jako `null` i wyświetlane w raporcie jako
   `(brak nazwy)`; nie jest to sygnał wygaśnięcia oferty ani powód odrzucenia
   całego feedu. Odrzucenie jest celowo ostrożne: tekst `<!ENTITY` nawet wewnątrz CDATA
   spowoduje błąd. Encje tekstowe i CDATA są obsługiwane. Nieznane pola oferty
   są zapisywane tylko jako nazwy w `extraFields`, bez interpretacji wartości.
3. Porównuje oferty z poprzednią poprawną kopią po `oid`, w stabilnej kolejności:
   - `NEW_IN_CATALOG` — nowy `oid`;
   - `CHANGED_IN_CATALOG` — zmienione pola (nazwy pól, a dla linków i opisu
     tylko host i skrót sha256). Zmieniony `url` dostaje flagę `linkChanged`
     i jest wyłącznie sygnałem do ręcznego przeglądu;
   - `MISSING_FROM_CATALOG` — `oid` zniknął. **To nie jest wygaśnięcie.**
     Narzędzie nigdy nie ustawia `EXPIRED`; sprawdź ofertę u banku.
   Zmiana kolejności ofert w XML nie jest raportowana jako zmiana.
4. **Pierwszy poprawny odczyt to baseline.** Nie generuje 113 alarmów „nowa
   oferta”.
5. Zapis jest atomowy (plik tymczasowy + `os.replace`). Najpierw zapisywane jest
   porównanie, a na końcu snapshot:
   - `latest-snapshot.json` — `schemaVersion, source, readAt, sha256, byteSize,
     offerCount, offers` (bez surowego XML);
   - `latest-comparison.json` oraz `comparisons/<czas>-<sha>.json`.

Raport na stdout zawiera liczniki, `oid`, nazwę i nazwy zmienionych pól. Nie
zawiera pełnych linków partnerskich ani surowego XML. Snapshot w `--state-dir`
przechowuje pełne `url`, bo jest potrzebny do porównań. Traktuj ten katalog
jako lokalny i go nie publikuj.

## Osobne źródła

Katalog eBroker informuje tylko o tym, **co partner udostępnia do linkowania**.
Nie jest to źródło warunków promocji. Kampania afiliacyjna, czyli link, status
i stawka w panelu eBroker, oraz oficjalne warunki banku, czyli regulamin,
terminy i opłaty, to osobne źródła. Każde z nich trzeba sprawdzić osobno przed
zmianą danych w serwisie. Obecność oferty w XML nie potwierdza warunków, a jej
brak nie potwierdza zakończenia promocji.

## Testy

Testy są offline (bez sieci i bazy, z fixture'ami inline). Uruchom je z
katalogu głównego repozytorium:

```sh
python3 tests/ebroker_catalog_test.py
# lub
python3 -m unittest tests/ebroker_catalog_test.py -v
```

Testy nie są częścią `npm test` ani vitest. Status w momencie utworzenia:
**NOT_RUN** (pliki napisano bez uruchamiania Pythona).

## Ograniczenia pilota

- Brak schedulera i automatycznego uruchamiania; każde wywołanie to jeden odczyt.
- Brak pełnego monitoringu i powiadomień. Brak integracji z bazą,
  `data/new-promotions.json` i stroną.
- Brak dat, opłat i statusu afiliacji w źródle. Te dane trzeba weryfikować ręcznie.
- Uszkodzonego `latest-snapshot.json` narzędzie nie nadpisuje. Należy go
  przenieść lub poprawić ręcznie.
