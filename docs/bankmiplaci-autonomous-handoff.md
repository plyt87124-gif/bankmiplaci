# BankMiPlaci – autonomiczne przekazanie pracy (playbook roboczy)

TASK_KEY: bmp-autonomous-handoff-playbook-v1-20261004 · status: dokument roboczy, nie instrukcja workera.
Nie zmienia CLAUDE.md, AGENTS.md ani konfiguracji, uprawnień czy transportu workera.

## 1. Cel i priorytety
Cel: kwalifikujące się założenia kont przez linki partnerskie i zatwierdzony przychód.
Kolejność wartości przy konflikcie:
1. Rzetelność warunków i pomoc klientowi.
2. Przewagi wobec konkurencji.
3. SEO.
4. Organiczne filmy.
5. Płatne reklamy (na końcu).
Ten playbook to skończony element bufora pracy na czas niedostępności ChatGPT. Nie daje prawa do rozszerzania zakresu.

## 2. Checkpoint (stan na 2026-10-04)
- Etap1 i statystyki: wdrożone, main 5d14e8a. Nie powtarzać.
- Erste: włączony przez właściciela.
- Kolektor XML: utworzony w #37, poprawiony w #73/#74.
- Weryfikacja Codex: odtworzony kod, 33/33 unittest, dry-run 113 ofert,
  baseline i drugi odczyt: 113 bez zmian.
- Testy samego workera: NOT_RUN.
- Pola XML: oid, name, institution, logo, description, url, category, subcategory.
  Brak jawnych edycji, dat, taryf i statusów.
- Zniknięcie oferty z XML nie oznacza EXPIRED.
- Wynagrodzenie wydawcy to nie premia klienta. Nie mieszać tych pojęć w danych ani w UI.
- Pełny monitoring regulaminów: NIE uruchomiony.
- GSC: payment_required. Audyt publiczny ustawiony osobno.
- Źródło koordynacji: plan GitHub #20 (w sesji restricted nie czytać GitHub).

## 3. Kolejność prac
1. Dokumentacja pilota (#78).
2. Projekt harmonogramu, locka i retry kolektora.
3. Osobny rejestr dokumentów konkretnej edycji promocji.
4. Porównanie warunków (diff edycji i dokumentów).
5. Pilot jednej kampanii.
6. Przegląd i testy przed integracją.
7. Dopiero potem SEO/konwersja i marketing.
Nie przeskakiwać etapów. Etap jest otwarty, dopóki nie spełnia kryteriów z sekcji 4.

## 4. Kryteria ukończenia (dla każdego zadania)
- Zakres zgodny ze zleceniem, bez dodatkowych zmian poza nim.
- Pliki wymienione z nazwy, z rozróżnieniem: nowe, zmienione, nieruszone.
- Statusy osobno: kod napisany / testy uruchomione (wynik) / wdrożenie / rzeczywisty monitoring.
  Domyślnie każdy niewykonany element to NOT_RUN, a nie „OK”.
- Brak sekretów, .env, cookies i danych produkcyjnych w plikach i raportach.
- Fakty z XML nie są przedstawiane jako warunki promocji bez dokumentu źródłowego edycji.
- Raport mieści się w limicie znaków ze zlecenia.

## 5. Decyzje przy brakujących danych
- Brak daty, edycji, taryfy lub statusu w XML: pole `unknown`, bez zgadywania.
- Oferta zniknęła z XML: status „niewidoczna w feedzie”, nie EXPIRED, do weryfikacji.
- Brak dokumentu regulaminu edycji: nie publikować warunków jako pewnych, oznaczyć „do weryfikacji”.
- Nie da się odróżnić wynagrodzenia wydawcy od premii klienta: nie pokazywać kwoty klientowi.
- Brak danych do zadania: lokalny checkpoint + raport z blokadą i koniec tego zadania.
  Niezależne, z góry zlecone zadania mogą być dalej wykonywane.
- Niejasny zakres: wybrać węższą interpretację i odnotować to w raporcie.
- Blokada (uprawnienia, sieć, brak pliku): podać powód i zakończyć. Bez zapętlonych prób.

## 6. Tryb pracy Claude podczas niedostępności ChatGPT
- Wykonuje tylko zadania zlecone z góry, FIFO, niezależnie od kolejnej odpowiedzi ChatGPT.
- Nie wymyśla nowych zadań, nie samomodyfikuje workera, nie zmienia jego konfiguracji.
- Nie zna rzeczywistego czasu resetu puli i nie zakłada go.
- Bez commit/push/deploy, sieci, instalacji, bazy, produkcji i podagentów,
  chyba że konkretne zlecenie wyraźnie na to pozwala.

## 7. Protokół zwrotu (handoff)
Trigger docelowy: wiarygodny sygnał, że zostało <=5% puli 5h.
Ograniczenie: obecne narzędzia nie podają % puli ani czasu resetu, więc dokładny trigger
NIE działa. Do czasu jego wdrożenia zapis handoffu robimy na końcu każdego zadania z kolejki.

Zawartość zapisu:
- Wykonane: zadania zamknięte wg kryteriów z sekcji 4.
- Bieżące: zadanie w toku i miejsce przerwania.
- Następne: kolejne pozycje FIFO (bez nowych pomysłów).
- Pliki: ścieżki nowe/zmienione.
- NOT_RUN: testy, wdrożenia i monitoring, które nie zostały uruchomione.
- Źródła: z czego pochodzą fakty (PR, plik, dry-run, właściciel).
- Blokady: powód i czego brakuje do odblokowania.

Po powrocie ChatGPT: odbiera wyniki z zapisu i kontynuuje od checkpointu, zamiast zaczynać
od nowa. Weryfikuje rozróżnienie: kod napisany ≠ testy uruchomione ≠ wdrożenie ≠ monitoring.
