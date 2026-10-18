# Plan przyspieszenia strony (stan na 2026-10-18)

Dokument roboczy: co zmierzyliśmy, co z tego wynika i w jakiej kolejności to naprawiać. Nic z kroków 1-4 nie jest jeszcze zrobione.

## 1. Co zmierzyłem

Pomiar na produkcji (stara strona v1, bankmiplaci.pl), z przeglądarki, jedno wejście na stronę, kolejność jak w tabeli. „TTFB" = kiedy przychodzi początek odpowiedzi, „koniec HTML" = kiedy strona jest w całości odebrana.

| Strona | TTFB | koniec HTML | co robi |
|---|---|---|---|
| `/quiz` | 36 ms | 254 ms | prawie bez bazy |
| `/jak-to-dziala` | 51 ms | 205 ms | bez bazy |
| `/promocje` | 47-168 ms | 2,0-3,5 s | lista z bazy |
| `/` (strona główna) | 169 ms | ok. 6 s | cała lista z bazy |
| `/promocje/alior-konto-z-premia` | 33 ms | 6,8 s | kilka zapytań w kilku rundach |

Wnioski:

- **Sieć, Vercel i przeglądarka są szybkie.** Strony bez bazy ładują się w 0,2 s, a początek odpowiedzi zawsze przychodzi w ułamku sekundy.
- **Cały czas idzie na zapytania do bazy.** Im więcej zapytań ma strona, tym dłużej ładuje się jej treść (2-7 s). To dokładnie ta wolność, którą widzisz przy wchodzeniu w promocje i na stronę główną.
- Lokalnie baza odpowiada w 0-10 ms (jest lokalna), więc lokalny „wolny" serwer deweloperski mówi tylko o kompilacji, a nie o produkcji. Wcześniej błędnie zinterpretowałem lokalne czasy jako opóźnienie bazy - to nieprawda.

Nie mam dostępu do konsoli Neon ani Vercela (nie jestem tam zalogowany), więc **przyczyny po stronie bazy trzeba potwierdzić** (krok 0).

## 2. Hipotezy, od najbardziej prawdopodobnej

1. **Odległość między funkcją a bazą.** Jeśli region funkcji Vercela (domyślnie Waszyngton, `iad1`) jest inny niż region Neon (Europa), to każde zapytanie to kilkaset ms w obie strony, a strona ofert robi kilka rund po kilka zapytań. Wystarczy 6 rund po 0,5-1 s, żeby wyjść 3-7 s.
2. **Brak puli połączeń.** Adres bazy bez `-pooler` i bez limitu połączeń: w środowisku bezserwerowym każde uruchomienie funkcji otwiera nowe połączenie (kilkaset ms handshake), a przy limicie 1 równoległe zapytania stoją w kolejce. Na produkcji raz już wystąpił błąd puli (P2024) po wdrożeniu.
3. **Usypianie bazy.** Darmowy Neon usypia po kilku minutach bezczynności; pierwsze zapytanie budzi bazę 1-5 s. Pasuje do „czasem do 5 sekund", ale nie tłumaczy, czemu wolne są też kolejne wejścia.
4. **Nic nie jest buforowane.** Główny layout czyta ciasteczko sesji, więc Next renderuje każdą stronę od zera przy każdym wejściu i nie wolno mu użyć ISR (`revalidate`) - w kodzie są o tym komentarze. To nie powoduje samej wolności, ale **uniemożliwia jej ukrycie**: nawet strona, która się nie zmienia, idzie do bazy za każdym razem.

## 3. Plan

### Krok 0 - potwierdzenie (bez kodu, ok. 15 min, robi właściciel)

- Neon → projekt → Settings: **region**, czy włączone **Scale to zero** (usypianie), czy adres w `DATABASE_URL` Vercela zawiera **`-pooler`**.
- Vercel → projekt → Settings → Functions: **Function Region** (powinien być ten sam kontynent co Neon, dla Polski najlepiej Frankfurt `fra1`).
- Vercel → Logs: czas wykonania (Duration) dla `/promocje/...`, z podziałem na pierwsze i kolejne wejście.

Wynik tego kroku mówi, czy kroki 1-2 wystarczą, czy dojdzie jeszcze zmiana planu bazy.

### Krok 1 - konfiguracja (godzina, małe ryzyko)

- Wyrównać region funkcji i bazy (zmiana regionu w Vercelu, bez zmiany kodu).
- Przełączyć `DATABASE_URL` na adres z `-pooler` i dodać `?pgbouncer=true&connection_limit=5` (Prisma z pulą Neon). Ten sam adres jest wspólny dla podglądów i produkcji (patrz notatki o Vercelu), więc zmiana dotyczy obu.
- Jeśli baza usypia: wyłączyć usypianie (płatne) albo dodać lekki ping co kilka minut. W planie Hobby crony Vercela są tylko dzienne, więc ping musiałby iść z zewnątrz.

Oczekiwany efekt: stałe kilkaset ms na każde wejście zamiast kilku sekund, jeśli hipotezy 1-3 się potwierdzą.

### Krok 2 - mniej zapytań na stronę (kod, 1-2 dni)

- Strona oferty: dziś są co najmniej 3 rundy zapytań (oferta i użytkownik, potem sprawdzenie admina, potem 5 równoległych). Scalić w jedną rundę: oferta, oferty banku, ściąga, artykuł, historia, śledzenie razem.
- Strona główna i listy: jedno zapytanie o karty zamiast osobnych kopii (zapytanie jest już jedno, ale wynik jest ładowany w całości do pamięci; przy większej liczbie ofert trzeba stronicować w bazie, to jest punkt TODO WP-17 w `listingData.ts`).
- Do kart pobierać tylko potrzebne kolumny (już tak jest) i tylko potrzebne relacje.

### Krok 3 - bufor danych publicznych (kod, 2-3 dni, największy zysk)

- Dane, które nie zależą od użytkownika (lista kart, model strony głównej, oferta po slugu, oferty banku), opakować w `unstable_cache` z `revalidate` 60-300 s i znacznikami (`revalidateTag` po zapisie w panelu admina i po przeliczeniu ocen). Wtedy 99% wejść nie dotyka bazy.
- Wynik: strony ofert i list renderują się w dziesiątkach ms, baza jest dotykana raz na kilka minut.

### Krok 4 - strony statyczne dla gości (kod, 3-5 dni, WP-17)

- Usunąć z głównego layoutu odczyt ciasteczek (`getCurrentUser`, a od niedawna także `getServerSession` dla przełącznika admina). Sesję ma już klient: `SessionProvider` pobiera `/api/account/me`, a nowe elementy (czerwona poświata, przełącznik admina) też działają z zapytań z przeglądarki.
- Dzięki temu strony publiczne mogą być statyczne z ISR i serwowane z krawędzi sieci (50-100 ms), zamiast renderowane przy każdym wejściu.
- Uwaga na ryzyka znane z notatek: `loading.tsx` nad trasami z `notFound` robi miękkie 404, wersje robocze (DRAFT) i podgląd admina nie mogą trafić do bufora (osobna trasa albo wymuszenie dynamiczności po cookie), a strony z ciasteczkiem sesji (np. `/konto`) zostają dynamiczne.

### Krok 5 - pomiar przed i po

- Powtórzyć pomiar z sekcji 1 po każdym kroku (te same pięć stron). Dodać do odpowiedzi nagłówek `Server-Timing` albo włączyć Vercel Speed Insights, żeby widzieć czasy na produkcji bez ręcznego mierzenia.

## 4. Kolejność i zysk

| Krok | Wysiłek | Spodziewany zysk | Ryzyko |
|---|---|---|---|
| 0 potwierdzenie | 15 min | wiemy, co jest przyczyną | brak |
| 1 region + pula | 1 h | duży, jeśli hipotezy 1-3 | małe |
| 2 mniej rund | 1-2 dni | średni | małe |
| 3 bufor danych | 2-3 dni | bardzo duży | średnie (unieważnianie bufora) |
| 4 strony statyczne | 3-5 dni | największy (sam CDN) | wyższe (sesja, DRAFT, 404) |

Rekomendacja: zrobić krok 0 i 1 **przed** wdrożeniem nowej wersji (nie wymagają kodu i zmniejszą problem na obu wersjach), a kroki 2-3 w nowej wersji przed wdrożeniem. Krok 4 po wdrożeniu, jako osobna zmiana, bo dotyka sesji.
