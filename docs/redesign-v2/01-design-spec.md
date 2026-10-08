# Specyfikacja designu v2 „Papier i tusz” (FINALNA)

Wszystkie wartości kolorów to trójki RGB dla zmiennych CSS `--color-*` (zapis `r g b`, użycie `rgb(var(--color-x) / <alpha>)` w tailwind.config.ts, tak jak dziś). Kontrasty policzone wzorem WCAG 2.x z tokenów; pakiet WP-18 dodaje test, który to przelicza automatycznie z globals.css (nie ufamy liczbom z dokumentu bez testu).

## 1. Zasady nadrzędne
1. Jedna kwota = jeden bohater. Na karcie i w hero oferty kwota premii jest największym elementem; reszta to meta.
2. Linie zamiast cieni. Karty/panele: 1 px `line`. Cienie tylko dla elementów unoszących się (popover, modal, sticky pasek mobilny).
3. Kolor = znaczenie, nigdy jedyny nośnik znaczenia (każdy badge ma ikonę 14 px albo słowo).
4. Trudność jest neutralna (EffortMeter + słowo „Łatwa”), bez teal/gold/coral.
5. Ujawnienie afiliacji jest zawsze widoczne, w kontraście min. ink-500 i min. 13 px (preferowane 14), nie zwijane na mobile.
6. Dane niezweryfikowane to „Brak danych”, nigdy „0 zł”. Daty tylko z bazy.
7. Motion informuje (hover, otwarcie, postęp, ładowanie), nie ozdabia danych decyzyjnych.

## 2. Tokeny kolorów
### Jasny (domyślny) – `:root`
| token | RGB | rola |
|---|---|---|
| paper | 249 247 242 | tło strony |
| surface | 255 255 255 | karty, pola, modal |
| sunken | 241 238 231 | bloki informacyjne, ujawnienia, stopka, tło thead |
| ink-900 | 26 28 32 | tytuły, kwoty |
| ink-700 | 55 59 66 | treść |
| ink-500 | 88 93 102 | tekst pomocniczy, etykiety, zastrzeżenia (min. dla prawnych) |
| ink-400 | 104 108 116 | najsłabszy dozwolony tekst (daty, przypisy); NIE na tle ink-100 |
| ink-300 | 156 158 162 | WYŁĄCZNIE ikony/dekoracja; nigdy tekst |
| ink-100 | 238 234 226 | wypełnienia (chipy, szkielet, tło checkboxa) – NIE ramki |
| line | 226 222 213 | ramki kart, separatory (dekoracja) |
| line-strong | 128 128 126 | ramki kontrolek formularza (≥3:1, WCAG 1.4.11) |
| action | 11 94 82 | przyciski, linki, aktywne chipy |
| action-hover | 8 74 65 | hover przycisku |
| on-action | 255 255 255 | tekst na action |
| focus-ring | 15 123 108 | pierścień fokusa |
| teal-700 | 11 94 82 | = action (alias, zgodność kodu) |
| teal-600 | 15 123 108 | ikony, wypełnienia; tekst tylko na bieli/papierze |
| teal-500 | 21 150 131 | tylko elementy graficzne (pasek postępu, ikony) |
| teal-100 | 224 240 235 | tło aktywnych/wybranych elementów; tekst na nim = teal-700 lub ink-900 |
| gold-600 | 130 92 10 | tekst bursztynowy (termin ≤14 dni, nagroda) |
| gold-500 | 176 129 30 | wypełnienia/ikony/obrys |
| gold-100 | 246 235 205 | tło badge/RewardRow |
| warn / warn-100 | alias gold-600 / gold-100 | klasy semantyczne `text-warn`, `bg-warn-100` |
| coral-600 | 160 45 32 | błąd, „Zakończona” (tekst i ikony) |
| coral-100 | 248 225 220 | tło błędu/baneru zakończenia |
| success / success-100 | 22 101 62 / 223 240 229 | potwierdzenie zapisu, „możesz skorzystać”, bezwarunkowe 0 zł |
| info / info-100 | 42 82 130 / 226 234 244 | neutralna wskazówka, stan „niezalogowany” |
| logo-tile | 255 255 255 | płytka logo (stała w obu motywach) |
| ink-solid (LEGACY) | 26 28 32 | wycofywany; tylko admin i niezmigrowany kod; nowych użyć zakaz |

### Ciemny – `.dark`
paper 17 19 23; surface 25 28 34; sunken 13 15 18; ink-900 240 238 233; ink-700 208 206 200; ink-500 156 157 158; ink-400 138 141 148; ink-300 92 96 104 (dekoracja); ink-100 36 40 48; line 46 50 58; line-strong 110 115 124; action 94 207 184; action-hover 124 224 202; on-action 10 26 22; focus-ring 94 207 184; teal-700 94 207 184; teal-600 62 184 160; teal-500 48 160 138; teal-100 22 52 47; gold-600 230 190 100; gold-500 190 145 45; gold-100 54 44 22; coral-600 240 128 110; coral-100 58 30 26; success 110 200 150 / success-100 24 50 36; info 130 170 225 / info-100 26 38 56; logo-tile 255 255 255; ink-solid (LEGACY) 60 66 78 (widoczna płyta z białym tekstem 10:1, żeby admin nie miał niewidocznych przycisków).

### Wybrane kontrasty (do potwierdzenia testem WP-18)
Jasny: ink-900/paper ok. 15,9; ink-700/paper ok. 10,5; ink-500/paper ok. 6,2, /sunken ok. 5,7, /ink-100 ok. 5,5; ink-400/paper ok. 4,9, /surface ok. 5,3, /sunken ok. 4,55, /ink-100 4,39 → ZAKAZ (tam ink-500); action/paper ok. 7,2; on-action/action ok. 7,7; teal-700/teal-100 ok. 6,5 (teal-600/teal-100 tylko 4,38 → tekst na tincie zawsze teal-700); gold-600/gold-100 ok. 5,1; coral-600/coral-100 ok. 5,8; success/success-100 ok. 6,0; line-strong/paper ok. 3,7. Ciemny: ink-900/paper ok. 16; ink-500/surface ok. 6,3; ink-400/surface ok. 5,1; action/paper ok. 9,8; on-action/action ok. 9,5; line-strong/paper ok. 3,9.

### Zasady użycia (wymuszane testem i ESLintem)
- `text-ink-300` zakazany dla tekstu (tylko ikony/dekoracja). Zastępnik: ink-400 (drobne meta) lub ink-500 (zastrzeżenia, ujawnienia).
- `border-ink-100` zakazany dla kart i kontrolek: karty `border-line`, kontrolki `border-line-strong`.
- `bg-ink-solid text-white` i `bg-teal-700 text-white` zakazane: `<Button>` lub `bg-action text-on-action`.
- Klasy nieistniejące (h-13, ink-200) usunięte; `ink-400` zdefiniowane w configu.
- Stare nazwy gold-600/coral-600 są teraz CIEMNIEJSZE (to kolory tekstu); wypełnienia ikon i obrysy przepiąć na gold-500 / teal-600.
- Przycisk disabled: `bg-ink-100 text-ink-500 border-line`, bez opacity.

## 3. Typografia
- Fonty (`next/font/google`, `display: swap`, subsets `['latin','latin-ext']` OBA, bo polskie znaki są w latin-ext, a ASCII w latin): **Source Serif 4** (variable, oś `opsz`, `--font-display`) tylko dla h1, h2, dużej kwoty (karta, hero oferty), lead artykułów i wordmarku; **Inter** (variable, `--font-body`) dla całej reszty. Plex Mono i Fraunces usunięte. Kody promocyjne: `ui-monospace` w kapsułce (bez ładowania pliku). `font-optical-sizing: auto`.
- Token `--font-amount` (domyślnie display). Kwoty w tabelach, aside, porównaniu: Inter 600 + `.num`.
- Klasa `.num`: `font-variant-numeric: lining-nums tabular-nums`. Oceny zawsze z przecinkiem: `formatRating(9.4)` → „9,4” (Intl.NumberFormat pl-PL, 1 miejsce).
- Skala (fontSize w tailwind.config.ts jako [rozmiar, {lineHeight, letterSpacing, fontWeight}]), mobile → od md/lg:
  - stat (kwota hero oferty, aside): 44/46 → 56/58, serif 600, −0.02em
  - amount (kwota karty): 36/40, serif 600, tnum; „zł” w 0,5em, wagi 500, twarda spacja U+00A0 przed „zł”, `white-space: nowrap`
  - h1 32/38 → 40/46, serif 600, −0.015em, `text-wrap: balance`
  - h2 24/32 → 28/36, serif 600, −0.01em
  - h3 20/28 Inter 600; h4 17/26 Inter 600
  - lead 19/30 (serif 400) → 21/32
  - body-article 17/28 (do 18/30 od lg), max 68ch; body-ui 16/26; small 14/22; caption 13/18 (MINIMUM dla treści informacyjnej); label 12/16 uppercase +0,06em 600 (tylko etykiety „PREMIA DO”, „TERMIN”)
- Zakaz rozmiarów <12 px i klas `text-[10px]`/`text-[11px]`. Treść redakcyjna (opisy oferty, warunki, FAQ, lead, artykuły, strony prawne) 17/28; chrome UI (nawigacja, filtry, meta karty) 14–16 px.
- `p { text-wrap: pretty }`, `hyphens: manual`, `overflow-wrap: break-word` (break-all tylko dla gołych URL-i; usuwa łamanie polskich słów w opłatach).
- Artykuły/prawne: kolumna 44 rem (~68ch), linki podkreślone (offset 3 px, kolor action), blockquote z lewą linią line-strong na sunken, tabele z border-line i nagłówkiem sunken.

## 4. Kształt, odstępy, siatka
- Promienie: 6 px (badge, chip tekstowy), 8 px (płytka logo, chipy filtrów prostokątne), 10 px (przyciski, pola), 14 px (karty, panele, EligibilityBanner), 16 px (modal), 999 px tylko segment Osobiste/Firmowe i przełącznik motywu.
- Cienie: brak dla kart. `shadow-pop` (popover/select-menu): `0 6px 20px -6px rgb(26 28 32 / .18)`. `shadow-modal`/sticky mobile: `0 12px 40px -12px rgb(26 28 32 / .28)`; w ciemnym `rgb(0 0 0 / .55)`. Overlay modalu `rgb(17 19 23 / .55)` bez blur.
- Odstępy: baza 4 px; skala 4-8-12-16-24-32-48-72-96. Sekcje: 48 mobile / 72 desktop; główne bloki home 96. Padding karty 20 (mobile 16... 20 px zalecane, sprawdzić pierwszy ekran 360 px: min. 1 pełna karta + początek drugiej). Gap siatki 16 mobile / 24 desktop.
- Kontener: `.container-page` max 70 rem (1120 px), gutter 16/24/32; kolumna czytania max 44 rem; strona oferty 12 kolumn: treść 8 + lepki aside 4 (szer. 22–24 rem, top 88 px); `scroll-padding-top: 5rem`, `section[id]` scroll-margin-top 5rem.
- Siatka kart: 1 kol. <640, 2 kol. 640–1023, 3 kol. ≥1024. Filtry: panel boczny 16 rem tylko od xl; poniżej pasek + bottom-sheet.
- Cele dotykowe min. 44×44 px (przyciski, chipy, hamburger, przełącznik motywu, checkbox ściągi – obszar 44 px, sam kwadrat 24 px). Brak poziomego scrolla od 320 px.
- Ikony lucide-react: stroke 1,5, rozmiary 16/20/24.
- Pole formularza: `.input` h-12 (48) w formularzach (logowanie, komentarze, kontakt), h-11 (44) w pasku filtrów; `border-line-strong`, bg surface, radius 10, focus: `border-action` + `ring-2 ring-action/25`; `accent-color: rgb(var(--color-action))` dla natywnych checkboxów/radio. Jedna klasa `.input`/`.select` we WSZYSTKICH miejscach (Filters, Auth, Comments, Kontakt…).

## 5. Komponenty (kontrakty)
**Button** (`ui/Button`, jedyna implementacja; zastępuje 34 inline kopie): warianty primary (bg-action text-on-action 600), cta (primary + ikona ArrowRight 18, WYŁĄCZNIE dla linków /out, zawsze z AffiliateDisclosure cta pod spodem), secondary (surface, border-line-strong, hover sunken), ghost (text-ink-700, hover bg-ink-100), danger (bg coral-600, białe/ciemne on-coral). Rozmiary: sm h-9 px-4 text-sm (tylko gęste toolbary, hit-area 44 przez padding), md h-11 px-5 text-base, lg h-14 px-8 text-[17px] (naprawa nieistniejącego h-13). Stany: hover bg-action-hover 150 ms; active scale .98 (120 ms); focus-visible outline 2 px focus-ring offset 2; disabled jw.; loading: spinner 16 px, aria-busy. Link /out: `<a href="/out/…" rel="sponsored nofollow noopener noreferrer">` przez istniejący AffiliateCtaLink (zachować zachowanie śledzenia), render jako Button cta.

**Badge** (radius 6, h-6, px-2.5, 13 px/600, ikona 14 px lub kropka): neutral (ink-100/ink-700) dla typu konta, trudności, „Zweryfikowano”; verified (teal-100/teal-700 + ShieldCheck); success (success-100/success) „Bez opłat za konto” TYLKO przy bezwarunkowym 0 zł i bez gwiazdki; warn (gold-100/gold-600 + Clock) „Koniec za N dni” ≤14 dni; danger (coral-100/coral-600) „Koniec za N dni” ≤3 dni lub „Zakończona”; info (info-100/info) „Zaktualizowano”; reward (gold-100/gold-600) tylko ściąga/licznik zarobków; outline (border-line-strong/ink-700 + Info) „Link partnerski”. Brak kolorowych badge’y trudności.

**BankLogo** (nowy): zawsze biała płytka (`bg-logo-tile`, radius 8, `ring-1 ring-line`, padding 6×10), `next/image` z jawnymi width/height (srcset tylko 1x/2x), `object-contain` wyśrodkowany, `alt` = nazwa banku. Rozmiary: xs 88×32 (tabela), sm 112×40 (karta), md 140×48 (porównanie, ściąga), lg 160×56 (nagłówek oferty). Ciemny motyw: `filter: brightness(.93)` TYLKO na płytce (nie na karcie). Fallback (brak URL lub onError): monogram 1–2 litery (Source Serif 4 600, 16 px, ink-700 na ink-100) w tej samej płytce. Nazwa banku jest tekstem obok, nie powtórzona pod logo. Bez mix-blend/invert.

**PromotionCard** (cała karta = jeden link do /promocje/[slug] przez wzorzec stretched-link: `::after` na tytule, `inset-0`; ocena i „Jak liczymy?” to osobny link z `relative z-10`; `flex flex-col h-full`, radius 14, border-line, bg surface, padding 20/16, brak cienia):
1. rząd: BankLogo sm + po prawej Badge neutral „Konto osobiste/firmowe”
2. tytuł = nazwa oferty (h3 Inter 600 17/24, line-clamp-2, min-h 3rem); gdy brak logo, nazwa banku overline 12 px nad tytułem
3. bohater: label „PREMIA DO” (12 px ink-500) + kwota serif 36/40 (`--font-amount`); gdy maxBonusCents=0 → zamiast kwoty „Bez premii gotówkowej” + tytuł oferty niesie korzyść (np. „0 zł za konto i kartę”); pod kwotą jedna linia „za: {pierwszy warunek lub skrócone summary}” 14 px ink-500 line-clamp-1
4. rząd meta: EffortMeter z etykietą · Badge terminu („Ważna do 31.10.2026”; ≤14 dni „Koniec za N dni”) · „Konto: 0 zł po warunku / 12 zł / Brak danych”
5. JEDNA linia weryfikacji: ShieldCheck + „Zweryfikowano 6 paź 2026” (14 px ink-400; progi: ≤14 dni ikona action; 15–45 ikona ink-400; >45 „sprawdzamy ponownie”; brak daty „Brak daty weryfikacji”) – wyłącznie z lastVerifiedAt
6. stopka (`mt-auto border-t border-line pt-3`): lewo „Ocena serwisu 9,4/10” + link „Jak liczymy?” (→ /metodologia), prawo „Szczegóły” + ChevronRight 16 px (translateX 2 px na hover)
Hover (tylko `@media (hover:hover)`): `border-line-strong` + tło `sunken/40`, 150 ms; BEZ uniesienia i cienia. Focus-visible: outline 2 px focus-ring na całej karcie. Wygasła: baner danger „Zakończona dd.mm.rrrr”, logo grayscale, zamiast CTA „Aktualne promocje banku”. Roboczy (admin): Badge „Roboczy”. Karta przy sort=Polecane NIE dubluje ujawnienia (jest nad listą); opcjonalny neutralny Badge „Polecane” tylko jeśli pozycja wynika z czynnika partnerskiego – decyzja WP-09 (patrz plan ujawnień: domyślnie bez znacznika na kartach, ujawnienie jest nad listą i przy sortowaniu).

**Filters**: u góry segment `radiogroup` „Wszystkie | Osobiste | Firmowe” (pigułki h-11, z licznikami, aktywna `bg-action text-on-action`); pasek: `[Szukaj banku lub oferty]` (q) · Sortuj · `Filtry (n)`; sortowanie: zachować wszystkie wartości SortKey (`recommended`, `top-rated`, `highest-bonus`, `easiest`, `newest`, `ending-soon`) i URL-e; UI: select z widoczną etykietą na mobile, radiogroup segment od lg dla 4 głównych („Polecane”, „Najwyższa premia”, „Najlepsza ocena”, „Kończące się”), pozostałe w „Więcej sortowań”; pod kontrolką ZAWSZE opis aktywnego sortowania (dla `recommended`: „Polecane uwzględnia m.in. wynagrodzenie partnerskie od banków. Ocena serwisu jest liczona bez niego. Jak zarabiamy”; dla `top-rated`: „Ocena serwisu nie uwzględnia prowizji. Jak liczymy”). Mobile: `Filtry` otwiera bottom-sheet (trudność jako fieldset+legend, chipy `aria-pressed`, min-h-11; bank; minimalna premia; „Tylko bez opłaty” z checkboxem 20 px) z przyciskiem „Pokaż N wyników”. Chipy aktywnych filtrów (h-9, bg-ink-100, X 44 px hit-area) + „Wyczyść”. Licznik w `role=status aria-live=polite`, poprawna odmiana (`pluralizePl`). Wartości kontrolowane z searchParams; `router.replace(..., {scroll:false})`; `isPending` → siatka opacity .6 po 150 ms + `aria-busy`. Whitelist `accountType`/`difficulty` w page.tsx (nieznane wartości ignorowane, koniec 500).

**Header**: sticky, h-16 (mobile 56), bg paper/95, border-b przezroczysty → `line` po scrollu (IntersectionObserver na sentinelu, 200 ms), bez blur, bez kurczenia logo. Wordmark „Bankmiplaci” Source Serif 4 600 22 px (bez ikony na start). Nawigacja od lg: Promocje · Porównaj · Quiz · Poradniki · Jak to działa (`aria-current="page"`, podkreślenie 2 px action, `whitespace-nowrap`); po prawej „Zaloguj się” (ghost) / „Moje konto”, EarningsCounter (gdy zalogowany), ThemeToggle 44×44 trójstanowy. Hamburger <lg (44×44, `aria-controls`, Esc zamyka i zwraca fokus, rozwijanie grid-rows 200 ms). Skip-link „Przejdź do treści” jako pierwszy element body (layout). CTA „Znajdź promocję” w nagłówku usunięte (duplikuje „Promocje”).

**Footer**: tło sunken, border-t line, 4 kolumny: Narzędzia (Promocje, Porównaj, Quiz, Moje konto), Wiedza (Poradniki, FAQ, Jak to działa, Konta osobiste z premią, Konta firmowe z premią, Banki), Zaufanie (Jak zarabiamy, Metodologia oceny, O nas, Zgłoś błąd/Kontakt), Prawo (Regulamin, Prywatność, Cookies). Pod nimi blok ujawnienia (AffiliateDisclosure footer, 14 px ink-500, max 68ch), wiersz „Dane zaktualizowano: {max lastVerifiedAt}”, wiersz wydawcy (dane już publiczne w regulaminie), copyright. Stare zdanie „nie jest oficjalnym partnerem żadnego banku” USUNIĘTE.

**Table (porównanie/archiwum/wiersze opłat)**: `<caption class="sr-only">`, `<th scope="col">` w sticky thead (bg paper, border-b line-strong), pierwsza kolumna `<th scope="row">` lepka z separatorem 1 px line-strong po prawej; kontener `role="region" tabindex="0" aria-label="…przewijana poziomo"`; liczby `.num` w Inter 600; wiersze `border-b border-line`, hover `bg-sunken`; najlepsza wartość w wierszu: pogrubienie + ikona Check 14 px + słowo (sr-only „najlepsza”), BEZ kolorowego tła; link tylko w nagłówku kolumny i w ostatnim wierszu akcji; brak `target=_blank`. Mobile: kolumna etykiet 104 px, kolumny ofert 148 px, `scroll-snap-type: x mandatory` (2 kolumny widoczne).

**Accordion (FAQ, szczegóły, „Z czego składa się premia”)**: natywne `<details><summary>` w komponencie serwerowym (zero JS, cała treść w DOM). summary min-h 56, Inter 600 16/24, chevron 20 px obrót 180° 200 ms; `border-b line`, bez ramki pudełka; panel 17/28 ink-700, padding-bottom 24; animacja grid-rows 250 ms z fallbackiem bez animacji; pierwsza pozycja `open`.

**EligibilityBanner**: radius 14, bg sunken, border line, lewy pasek 3 px; stany: eligible (success + CheckCircle „Możesz skorzystać od {data}”), waiting (gold-500 + Clock „Karencja do {data}”), not-eligible (coral-600 + XCircle „Prawdopodobnie nie kwalifikujesz się: {powód}”), logged-out (info + LogIn „Zaloguj się, by sprawdzić, czy możesz skorzystać” + przycisk secondary otwierający AuthModal). Tekst zawsze ink-900/ink-700 (kolor wspiera tylko ikonę i pasek). Pod spodem 14 px ink-500: „Zawsze sprawdź warunki uczestnictwa w regulaminie banku (link w sekcji Źródło).”

**EffortMeter**: 4 segmenty 16×6 radius 2, wypełnione ink-900, puste ink-100 (z ramką line w ciemnym), mapowanie 1–4 (Bardzo łatwa/Łatwa/Średnia/Trudna), obok słowo 14–15 px 600, `role="img"` z `aria-label="Trudność: łatwa, 2 z 4"`. Bez koloru semantycznego.

**Ściąga (PromotionChecklist) – tylko prezentacja**: karta jak „notatnik” (surface, border-line, radius 14); nagłówek miesiąca to `<h3>`; krok = wiersz min-h 52 z natywnym (stylizowanym `appearance-none`) `<input type="checkbox">` 24 px (border 2 px line-strong, zaznaczony bg-action + ptak on-action, animacja check-in 160 ms tylko po interakcji), etykieta 17/24, zaznaczony krok ink-500 bez przekreślenia; pasek postępu 4 px (`role="progressbar"`, track ink-100, fill teal-500, `scaleX` 400 ms); zablokowany miesiąc: `aria-disabled` + ikona Lock + tekst „Odblokuje się dd.mm.rrrr” w ink-700 (BEZ opacity-50), tło sunken; nagroda (RewardRow): gold-100, ikona Gift gold-600, kwota serif gold-600, przy odblokowaniu jednorazowy `ring-pulse` 600 ms; przyciski „Zaznacz cały miesiąc” / „Cofnij zaznaczenie” min-h-11; błąd zapisu w `role="status"`. Słownictwo: „zaznaczaj/odhaczaj” = wykonane; „odznacz/cofnij” = cofnięcie.

**Pozostałe**: Input/.input jak wyżej; błąd: border coral-600 + ikona + komunikat `role="alert"` 13 px + `aria-describedby`/`aria-invalid`. Modal: natywny `<dialog>` + `showModal()` (focus trap, inert, Esc), radius 16, max-w 440, `aria-labelledby`, przycisk X 44×44, linki do Regulaminu/Polityki pod przyciskiem, wejście fade 160 ms + translateY 8 px/scale .98→1 200 ms, zamknięcie natychmiastowe; zamykanie tła tylko gdy mousedown i mouseup na backdropie. Breadcrumbs: 14 px ink-500, separator „/”, ostatni ink-900, generują BreadcrumbList. Szkielet (Skeleton): bg-ink-100, pulse 1→.55→1 1,6 s, ta sama geometria co realne elementy. Toasty/komunikaty: blok z ikoną, `role=status|alert`. Komentarze: lista `<ul>`, `<label class="sr-only">` dla textarea, lajk jako przycisk z `aria-label` i `aria-pressed`, min 44 px; nota „Opinie użytkowników – nie weryfikujemy ich. Nie stanowią porady.”

## 6. Motion (wszystko w `src/styles/motion.css`, jeden plik do przeglądu/usunięcia)
- Tokeny `:root`: `--ease-out: cubic-bezier(.22,.61,.36,1)`, `--ease-in-out: cubic-bezier(.4,0,.2,1)`, `--dur-fast:120ms`, `--dur-base:200ms`, `--dur-accordion:250ms`, `--dur-reveal:400ms`; Tailwind: `transitionTimingFunction.out/inOut`, `transitionDuration`, `future.hoverOnlyWhenSupported: true`.
- Wyłącznik awaryjny: skrypt w `<head>` (razem z motywem) dodaje klasę `motion-ok` na `<html>` tylko gdy `!matchMedia('(prefers-reduced-motion: reduce)').matches`. Efekty wejścia/count-up/opóźnienie szkieletu działają wyłącznie pod `.motion-ok`, więc bez JS i przy reduced-motion treść jest widoczna od razu (zero `opacity:0` w HTML z serwera). W bloku reduced-motion: `html{scroll-behavior:auto}`, wyłączone transform-hovery i animacje.
- Zasady: tylko `transform` i `opacity` (+ `grid-template-rows` dla zwijania, `background-color`/`border-color`); nigdy width/height/top/left/backdrop-filter/globalny will-change; max 1–2 niezależne ruchy w kadrze; dystans ≤8 px, skala .98–1.03; brak pętli poza szkieletem; CTA /out nigdy nie czeka na animację.
- Zestaw: (1) przyciski: tło 150 ms, active scale .98; (2) karta: ramka 150 ms (bez lift), strzałka translateX 2 px 200 ms; (3) Reveal sekcji PONIŻEJ pierwszego ekranu na home: opacity 0→1 + translateY 8px→`none` 400 ms ease-out, IO threshold .15, raz, stagger (index%6)×40 ms (≤200 ms łącznie), failsafe `animation: reveal-failsafe 0s 2.5s forwards`, `@media print` widoczne; NIE dla hero/LCP, FAQ, bloga, prawnych, list wyników, admina; (4) akordeon i menu mobilne: grid-rows 250/200 ms, treść zawsze w DOM + `inert` gdy zamknięte; (5) header po scrollu 200 ms; (6) filtry: `isPending` → opacity .6 po 150 ms zwłoki + pasek 2 px scaleX .1→.9 800 ms, po wyniku fade 160 ms bez translate i bez staggeru; (7) szkielety `loading.tsx`: pojawiają się po 200 ms (fade 150 ms), pulse 1,6 s, w reduced-motion statyczne, `role=status` + sr-only „Ładowanie”; (8) ściąga: pasek scaleX 400 ms, check-in 160 ms, odblokowanie miesiąca transition-colors 300 ms, nagroda `ring-pulse` 600 ms raz; EarningsCounter: count-up 800 ms (zamiast 2400), pop max scale 1,04 przez 400 ms bez overshootu poniżej 1, USUNĄĆ iskry (PARTICLE_ANGLES, earnings-firework), JS count-up respektuje matchMedia; (9) CountUp wyłącznie dla agregatów (licznik aktualnych promocji w hero, kwota w Moim koncie), 700–800 ms easeOutCubic, SSR zawiera wartość końcową, zapis `ref.textContent` (bez setState na klatkę), `aria-label` z wartością końcową; NIGDY na premiach, opłatach, ocenach; (10) modal jw.; (11) sticky pasek CTA mobile: translateY(100%→0) 200 ms po wyjściu głównego CTA z viewportu; (12) wskaźnik „Zweryfikowano” statyczny.
- Zakazy: bounce/spring/overshoot na kwotach, konfetti, iskry, animowane gradienty, shimmer-sweep, karuzele auto-play, parallax, scroll-jacking, `animation-timeline`, dźwięk/wibracje, pulsujący ping „live” (zastąpić statyczną kropką), animowane liczby danych decyzyjnych, animacje sugerujące więcej zaufania, niż dają dane. Biblioteka animacji niepotrzebna (CSS + 2 hooki).

## 7. Migracja tokenów (codemod i reguły; wykonują pakiety w swoich plikach)
`border-ink-100` → `border-line` (kontrolki: `border-line-strong`); `text-ink-300` (tekst) → `text-ink-400` (meta) / `text-ink-500` (zastrzeżenia); `text-[10px]|text-[11px]` → `text-xs`/caption 13; `bg-ink-solid … text-white` → `<Button>` lub `bg-action text-on-action`; `hover:bg-teal-700` na białym tekście → `hover:bg-action-hover`; `bg-teal-600 text-white` (CTA) → `<Button variant="cta">`; `text-gold-600`/`text-coral-600` zostają (nowe, ciemniejsze wartości), ale wypełnienia ikon/ramek → `gold-500`/`teal-600`; `h-13` → `<Button size="lg">`; `text-ink-400` – dziś nieistniejący, po WP-01 istnieje; `break-all` → `break-words`; `toFixed(1)` na ocenie → `formatRating`; `animate-ping` usunięte; `scroll-smooth` usunięte z html.

## 8. Kryteria odbioru designu
Axe-core bez critical/serious na 13 stronach × 360/1280 px × oba motywy; ręczny test klawiaturą (modal, filtry, ściąga, tabela); brak poziomego scrolla 320 px (w tym /porownaj); CLS 0 szkieletów; `prefers-reduced-motion` respektowane (CSS i JS); logika funkcjonalna nietknięta (npm test 114 + tsc + eslint zielone).