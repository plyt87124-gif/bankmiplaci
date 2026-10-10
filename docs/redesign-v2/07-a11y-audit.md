# 07. Audyt dostępności (fala E, pakiet AUDIT)

Data: 2026-10-10. Gałąź `redesign/v2`. Audyt automatyczny (axe-core) i kontrole ręczne wykonane programowo (Playwright, Chromium headless) na działającym dev-serwerze `http://localhost:3000`. Narzędzie: `scripts/a11y-audit.mjs` (`npm run audit:a11y -- --help`).

## Wynik w skrócie

- axe-core 4.13.0, 112 przebiegów (28 stron x 2 szerokości x 2 motywy): **0 naruszeń** na wszystkich poziomach (critical 0, serious 0, moderate 0, minor 0). Liczba naruszeń była taka sama przed i po audycie, bo nic nie wymagało poprawki w kodzie serwisu.
- Brak poziomego scrolla i brak błędów konsoli w żadnym przebiegu.
- Kontrole ręczne (klawiatura, fokus, reduced motion, zoom, cele dotyku): 75 sprawdzeń, 0 błędów, 0 uwag po poprawieniu samego skryptu (patrz niżej: pierwsze uruchomienie dało 12 fałszywych alarmów skryptu, nie błędów serwisu).
- **W `src/**` nie zmieniono żadnego pliku.** Zmiany: nowy skrypt audytu, skrypt npm, devDependency `axe-core`, ten dokument. Poprzednie fale (tokeny kontrastu, bramki `ui-tokens`/`contrast`) już zapewniały zgodność, audyt to potwierdził.

To nie jest dowód pełnej zgodności z WCAG 2.2 AA: axe wykrywa ok. jedną trzecią problemów, a czytników ekranu nie testowano (sekcja "Niezweryfikowane").

## Metoda

### Część 1: axe-core (`--axe`, domyślna)

- Strony (28), po kolei, nie równolegle: `/`, `/promocje`, oferta aktywna (`/promocje/creditagricole-kapitalna-premia`, pierwsza z sitemapy), oferta zakończona (`/promocje/pekao-promocja-podrozna`, `endDate` 2026-08-31, strona pokazuje "Zakończona"), `/promocje/konczace-sie`, `/konta-osobiste-z-premia`, `/konta-firmowe-z-premia`, `/banki`, `/banki/pko`, `/porownaj`, `/quiz`, `/blog`, `/blog/kategoria/poradniki` (pusta kategoria), `/jak-to-dziala`, `/faq`, `/jak-zarabiamy`, `/metodologia`, `/o-nas`, `/kontakt`, `/regulamin`, `/polityka-prywatnosci`, `/cookies`, `/konto/logowanie`, `/konto/rejestracja`, `/konto/zapomniane-haslo`, `/konto/reset-hasla`, `/konto` (bez sesji: przekierowanie na logowanie), `/nie-ma-takiej-strony` (404, oczekiwany status 404).
- Szerokości 360 i 1280 px; motywy `light` i `dark`. Motyw ustawiany przez `localStorage.theme` przed załadowaniem strony (samo `prefers-color-scheme` nie przełącza motywu serwisu).
- Tagi axe: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`.
- Dla każdej strony: `load`, 1500 ms, przewinięcie całej strony (żeby `Reveal` się odsłonił), powrót na górę, axe. Z reguł wyłączony overlay dev-serwera Next (`nextjs-portal`, przycisk "N"), bo to nie kod serwisu.
- Dodatkowo: brak poziomego scrolla (`scrollWidth <= innerWidth`) i brak błędów konsoli (`console.error`, `pageerror`; poza oczekiwanym wpisem 404 dla strony 404).
- Sprawdzenie samego narzędzia: do strony `/faq` wstrzyknięto obrazek bez `alt`, pusty przycisk i tekst o słabym kontraście. Axe zgłosił `image-alt`, `button-name`, `color-contrast`, więc skrypt nie milczy przy błędach.

### Część 2: kontrole ręczne (`--manual`)

| Kontrola | Zakres |
|---|---|
| (a) Klawiatura | Kolejność Tab na stronie głównej (1280 px, 45 przystanków): pierwszy przystanek to "Przejdź do treści", brak fokusu na elementach ukrytych, `inert`, w `aria-hidden`; kolejność zgodna z wizualną (skok w górę dozwolony tylko przy przejściu do następnej kolumny siatki). Menu mobilne (360 px): Enter otwiera, Tab przechodzi po pozycjach, Tab poza ostatnią zamyka menu, Esc zamyka i oddaje fokus przyciskowi, zamknięte menu jest `inert`. Arkusz filtrów (360 px) i modal logowania (1280 px): Enter otwiera, fokus wchodzi do dialogu, 30 naciśnięć Tab/Shift+Tab nie wyprowadza fokusu na stronę pod spodem, Esc zamyka, fokus wraca na przycisk otwierający. |
| (b) Widoczny fokus | Tab przez strony `/`, `/promocje`, oferta, `/porownaj`, `/quiz`, `/konto/logowanie`, `/faq` (do 70 przystanków na stronę), 2 szerokości x 2 motywy, razem ok. 1000 przystanków. Wskaźnik: outline lub pierścień z `box-shadow`, także na `::before`/`::after` (karty ze "stretched linkiem" rysują obrys na `::after`), grubość >= 2 px, kontrast >= 3:1 względem tła (złożonego z przodków). Dla pól tekstowych wskaźnikiem jest ramka zmieniająca kolor na kolor akcji (miękki pierścień `ring-action/25` sam kontrastu 3:1 nie osiąga). |
| (c) prefers-reduced-motion | Emulacja `reduce` na `/`, `/promocje`, oferta, `/porownaj`, `/quiz`: klasa `motion-ok` nie jest ustawiona, bloki `Reveal` od razu w pełni widoczne, `CountUp` pokazuje wartość końcową od razu, brak przejść i animacji `transform`/`opacity` dłuższych niż 1 ms (globalna reguła w `motion.css` skraca je do 0,01 ms), `document.getAnimations()` bez animacji > 1 ms. |
| (d) Zoom 200% / 400% | Viewport 640x512 i 320x256 px na 9 stronach: brak poziomego scrolla, brak elementów wystających poza viewport poza przewijanymi kontenerami, brak ucinanego tekstu, przypięte (fixed/sticky) elementy zajmujące mniej niż 40% wysokości okna. |
| (e) Cele dotyku | WCAG 2.5.8 (>= 24x24 CSS px, linki w zdaniu wyłączone, pole klikalne rozszerzone przez `::before`/`::after` liczone, checkbox/radio mierzone razem z etykietą) na 9 stronach x 2 szerokości; przycisk Menu >= 44x44; przyciski CTA `/out/` >= 44 px wysokości na 360 px. |

## Wyniki

### axe-core

| Poziom | Przed | Po |
|---|---|---|
| critical | 0 | 0 |
| serious | 0 | 0 |
| moderate | 0 | 0 |
| minor | 0 | 0 |

- 112 przebiegów; jeden przebieg (`/kontakt`, 360 px, light) zakończył się przekroczeniem czasu nawigacji 90 s (dev-serwer w tym czasie był restartowany), po powtórzeniu: 0 naruszeń. Skrypt ma teraz jedno automatyczne ponowienie przy przekroczeniu czasu.
- Liczba reguł zaliczonych w przebiegu: 41 do 56 (zależnie od strony).
- **Wyniki "incomplete" (axe nie umiał rozstrzygnąć):** 64 węzły reguły `color-contrast` w 16 przebiegach. Wszystkie sprawdzone ręcznie (kontrast liczony z kolorów obliczonych i tła przodków):
  - `/promocje`: pole sortowania `select` (tło z obrazkiem, strzałka) 17,06:1 w jasnym i 14,72:1 w ciemnym motywie; etykieta "Premia do" na kartach (nakrywana przez rozciągnięty link karty) 6,62:1 jasny / 6,28:1 ciemny; to samo na `/konta-osobiste-z-premia` i na stronie oferty.
  - Oferta: zdanie "Link partnerski: możemy otrzymywać wynagrodzenie..." pod przyciskiem (część nakrywająca się z innym elementem) 6,62:1.
  - `/metodologia` (20 węzłów, 360 px) i `/cookies` (4 węzły, 360 px): komórki tabel przewijanych poziomo, częściowo poza widocznym obszarem kontenera; kontrast 10,51:1 (jasny) i 11,82:1 (ciemny).
  - Wszystkie wartości >= 4,5:1, więc nie ma naruszeń; to fałszywe "incomplete", typowe dla tekstu pod warstwą klikalnego pseudo-elementu i dla treści w kontenerze z przewijaniem.

### Kontrole ręczne (uruchomienie końcowe: 75 OK, 0 błędów)

- Klawiatura: 20 sprawdzeń OK. Kolejność Tab strony głównej: pominięcie, logo, nawigacja, "Zaloguj się", przełącznik motywu, segment, hero, karty Polecane (tytuł karty, potem "Jak liczymy?"), kończące się, FAQ, linki do hubów. Menu mobilne i oba dialogi (natywny `<dialog>`: fokus zostaje wewnątrz, przy wyjściu poza skrajne elementy trafia na interfejs przeglądarki, co dla natywnego modala jest zachowaniem standardowym i skrypt zapisuje to jako liczbę, nie błąd).
- Widoczny fokus: 4 grupy (2 motywy x 2 szerokości) OK, ok. 250 elementów w grupie. Najsłabszy wskaźnik: ramka pola tekstowego, 3,70:1 (jasny) i 3,58:1 (ciemny).
- Reduced motion: 17 sprawdzeń OK (na `/` jedno wystąpienie `CountUp`, wartość końcowa od razu; 2 bloki `Reveal` widoczne od razu).
- Zoom: 16 sprawdzeń OK, brak poziomego scrolla przy 640 i 320 px na wszystkich 9 stronach.
- Cele dotyku: 18 sprawdzeń OK. Przycisk Menu 44x44. Przyciski `/out/` zmierzono tylko na `/porownaj` (4 sztuki, najniższy 58 px); na pozostałych stronach w obecnym stanie bazy nie było linków `/out/`, więc dla nich 44 px wynika wyłącznie z kodu (`Button` `md` = min-h-11, `lg` = min-h-14), a nie z pomiaru.

## Poprawki

W `src/**`: **żadnych** (nie znaleziono naruszeń do naprawienia).

Zmiany w repozytorium:

| Plik | Co | Dlaczego |
|---|---|---|
| `scripts/a11y-audit.mjs` (nowy) | Skrypt audytu: axe + kontrole ręczne, `--help`, limity czasu, raport tabelaryczny i JSON, kod wyjścia 1 przy naruszeniach | Powtarzalny audyt (`npm run audit:a11y`) |
| `package.json` | Skrypt `audit:a11y`; devDependency `axe-core` `^4.13.0` (wersja, która już była w `node_modules` jako zależność przechodnia `eslint-config-next`) | Skrypt nie może polegać na zależności przechodniej |
| `package-lock.json` | Jedna linia: `axe-core` jako zależność bezpośrednia (`npm install --package-lock-only`) | Spójność z `package.json` |
| `docs/redesign-v2/07-a11y-audit.md` (nowy) | Ten raport | |

### Fałszywe alarmy własnego skryptu (naprawione w skrypcie, nie w serwisie)

Pierwsze uruchomienie kontroli ręcznych zgłosiło 12 błędów. Wszystkie okazały się błędami metody, więc poprawiono skrypt:

1. Kolejność Tab: skok "w górę" z ostatniej karty do tytułu następnej karty w siatce, i przejście z bloku FAQ do kolumny linków obok, były liczone jako błąd. Teraz porównanie dotyczy kolejnych przystanków i dopuszcza przejście do kolumny po prawej.
2. Fokus 1:1 na tytułach kart: obrys rysowany jest na `::after` linku (link ma `outline-none`, czyli przezroczysty obrys), skrypt czytał tylko element. Teraz sprawdza też `::before`/`::after`.
3. Fokus 1,5:1 na polach tekstowych: skrypt mierzył tylko półprzezroczysty pierścień. Wskaźnikiem pola jest ramka w kolorze akcji (3,58:1 do 3,70:1), więc dla pól mierzona jest ramka.
4. Fokus na `nextjs-portal`: overlay dev-serwera, pomijany.
5. "Jak liczymy?" 85x22 px na kartach: pole klikalne rozszerza `::before` (`-inset-y-3`, ok. 46 px wysokości), skrypt nie liczył pseudo-elementów. Teraz je liczy.
6. `CountUp` na `/porownaj`: skrypt mylnie rozpoznał nagłówek tabeli (ikona `aria-hidden` plus tekst `sr-only`) jako `CountUp`. Selektor zawężono do markupu `CountUp`.
7. "Tekst ucinany" i "przypięte elementy 240 z 256 px": teksty `sr-only` i nagłówki `sticky top-0` w ramce tabeli, która nie przewija się pionowo (tam `sticky` jest nieaktywne). Skrypt pomija `sr-only` i nieaktywne `sticky`.

Brak ukrytych poprawek: żaden z tych punktów nie był zmianą zachowania serwisu.

## Niezweryfikowane

- **Czytniki ekranu (NVDA, JAWS, VoiceOver, TalkBack) nie były testowane.** Nie wiadomo, jak brzmią etykiety, kolejność odczytu, komunikaty dialogów i ogłoszenia (np. `aria-live`). To główna luka audytu.
- Przeglądarki inne niż Chromium (Firefox, Safari) i urządzenia dotykowe: niesprawdzone. Emulacja 360 px to okno desktopowe, nie telefon.
- Zoom sprawdzono przez zmniejszenie viewportu (640/320 px), nie prawdziwym powiększeniem przeglądarki; tekst powiększany samą czcionką (WCAG 1.4.4 przy 200% tylko tekstu) i odstępy tekstu (1.4.12) nie były testowane.
- Dev-serwer, nie build produkcyjny: markup może się nieznacznie różnić (np. identyfikatory `useId`). Nie badano stron za logowaniem (`/konto` po zalogowaniu, `/admin`), stanów błędów formularzy, filtrów po zastosowaniu, kroków quizu po odpowiedziach, tabeli porównania po dodaniu ofert, komentarzy, ściągi.
- Strona blogu: w bazie 0 artykułów, więc nie sprawdzono strony artykułu ani listy z wpisami (sprawdzono tylko pusty `/blog` i pustą kategorię).
- Rozmiar celów dotyku: nie zbadano wyjątku "odstępów" z 2.5.8 (okrąg 24 px bez przecinania innych celów), tylko rozmiar elementu z polem rozszerzonym o pseudo-elementy.
- Kontrast wskaźnika fokusu liczony ze złożonych kolorów tła przodków; tła z gradientem lub obrazkiem nie są uwzględniane (poza `select`, gdzie obrazek to tylko strzałka po prawej).
- Treść: jakość `alt`, zrozumiałość tekstów dla osób z niepełnosprawnością intelektualną, poprawność języka (`lang="pl"` jest ustawione, axe `html-has-lang` zaliczone) nie podlegają audytowi automatycznemu.
- Stany `:hover` i `:active` oraz `forced-colors` (tryb wysokiego kontrastu Windows): niesprawdzone.

## Znane ograniczenia narzędzia

- Wynik zależy od danych w bazie (jeden aktywny, jeden zakończony slug i bank są dobierane z sitemapy lub podawane opcjami `--offer`, `--expired`, `--bank`); oferta zakończona jest pomijana, gdy daje 404.
- Dev-serwer bywa wolny lub restartowany: limit czasu nawigacji 90 s (`--timeout`), jedno ponowienie.
- Skrypt nie loguje się i niczego nie zapisuje poza plikiem raportu JSON (domyślnie w katalogu tymczasowym systemu, poza repozytorium).

## Jak powtórzyć

```
npm run audit:a11y                       # axe, wszystkie strony x 360/1280 x jasny/ciemny
npm run audit:a11y -- --manual           # kontrole ręczne
npm run audit:a11y -- --all --out raport.json
npm run audit:a11y -- --only /faq --widths 360 --themes dark --verbose
```
