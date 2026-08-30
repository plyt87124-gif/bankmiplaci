# Standard UTM — Bankmiplaci.pl

Dokument obowiązujący przy tworzeniu każdego linku promowanego poza serwisem
(social media, reklama płatna, newsletter, partnerzy). Celem jest, żeby dane
w panelu admina (`utmSource` / `utmMedium` / `utmCampaign` / `utmContent` /
`utmTerm` w tabeli `clicks`) dało się rzetelnie zsumować i porównać między
kanałami — bez tego jeden i ten sam kanał rozjeżdża się na kilka wariantów
nazw i traci się porównywalność.

**Zasada nadrzędna, obowiązuje wszystkie parametry:**
- tylko **małe litery** (lowercase),
- **bez polskich znaków** (ą→a, ć→c, ę→e, ł→l, ń→n, ó→o, ś→s, ź→z, ż→z),
- **bez spacji** — separator to znak podkreślenia `_`,
- tylko znaki `a-z`, `0-9`, `_`.

Link bez UTM (np. zwykłe wpisanie adresu w przeglądarce, wynik organiczny
Google) nie wymaga tagowania — UTM służy wyłącznie do oznaczania linków,
które **sami tworzymy i rozsyłamy**.

---

## `utm_source` — platforma/źródło

Zamknięta lista. Nie wprowadzamy nowej wartości bez aktualizacji tego
dokumentu.

| Wartość | Kiedy używać |
|---|---|
| `google` | Reklama Google Ads, link z wizytówki Google itp. |
| `facebook` | Post własny, grupa FB, reklama Facebook Ads |
| `instagram` | Post, stories, reklama |
| `tiktok` | Film organiczny, reklama, współpraca z twórcą |
| `reddit` | Post/komentarz na subreddicie |
| `youtube` | Opis filmu, karta, reklama |
| `newsletter` | Link w mailu do subskrybentów |
| `partner` | Link umieszczony przez zewnętrzny serwis/partnera |

## `utm_medium` — rodzaj ruchu

Zamknięta lista.

| Wartość | Kiedy używać |
|---|---|
| `organic_social` | Bezpłatny post w social media |
| `cpc` | Reklama płatna (dowolna platforma) |
| `referral` | Link umieszczony na zewnętrznej stronie (nie social, nie mail) |
| `email` | Newsletter, mail transakcyjny z treścią marketingową |
| `influencer` | Współpraca z twórcą/influencerem (post/film z jego strony) |

**Typowe, poprawne kombinacje** (pomocniczo, nie jest to zamknięta reguła):

| `utm_source` | `utm_medium` | Przykład sytuacji |
|---|---|---|
| `facebook` / `instagram` | `organic_social` | Zwykły post na naszym profilu |
| `facebook` / `instagram` / `google` / `tiktok` | `cpc` | Kampania płatna |
| `tiktok` / `youtube` | `influencer` | Współpraca barterowa/płatna z twórcą |
| `reddit` | `organic_social` | Post/komentarz na subreddicie |
| `newsletter` | `email` | Kampania mailingowa |
| `partner` | `referral` | Artykuł/link na zewnętrznym serwisie |

## `utm_campaign` — nazwa konkretnej kampanii

Format: `{cel_kampanii}_{RRRR}_{MM}` — opisowy cel + rok + miesiąc startu,
wszystko małymi literami, oddzielone `_`.

Przykłady:
- `start_2026_08` — start promocji serwisu
- `konto_osobiste_2026_09` — kampania skupiona na kontach osobistych
- `promocje_bankowe_2026_09` — ogólna kampania promocji bankowych

Jedna kampania = jeden spójny cel/przekaz w danym okresie. Nie zmieniamy
nazwy kampanii w trakcie jej trwania — jeśli zmienia się przekaz, to nowa
kampania (nowa nazwa).

## `utm_content` — identyfikator konkretnego materiału

Format: `{typ_materialu}_{numer}` — dwucyfrowy numer z wiodącym zerem, żeby
sortowanie alfabetyczne pokrywało się z kolejnością.

Przykłady:
- `post_01`, `post_02` — kolejne posty tekstowe
- `video_01` — materiał wideo
- `reddit_01` — konkretny post na Reddicie
- `fb_group_01` — konkretna grupa na Facebooku

Używamy `utm_content`, gdy w ramach jednej kampanii i jednego źródła
publikujemy **więcej niż jeden** materiał — pozwala odróżnić, który
konkretnie post/wideo/grupa przyniosła kliknięcia.

## `utm_term` — tylko gdy faktycznie potrzebne

**Nie używamy domyślnie.** Zarezerwowane wyłącznie dla przypadków, gdzie
faktycznie chodzi o słowo kluczowe/wariant kierowania (np. konkretne słowo
kluczowe w kampanii Google Ads, wariant A/B tekstu reklamy). Jeśli nie ma
takiej potrzeby — parametr po prostu pomijamy w linku, nie wstawiamy pustej
wartości.

---

## Gotowe przykłady linków

```
https://bankmiplaci.pl/promocje/credit-agricole-kapitalna-premia
  ?utm_source=tiktok&utm_medium=organic_social
  &utm_campaign=start_2026_08&utm_content=video_01

https://bankmiplaci.pl/promocje
  ?utm_source=reddit&utm_medium=organic_social
  &utm_campaign=konto_osobiste_2026_09&utm_content=reddit_01

https://bankmiplaci.pl/
  ?utm_source=newsletter&utm_medium=email
  &utm_campaign=promocje_bankowe_2026_09&utm_content=post_01
```

(W realnym linku parametry łączy się znakiem `&` w jednej linii, bez spacji
i bez łamania — powyżej rozbite tylko dla czytelności.)

---

## Dobre i złe przykłady

| ❌ Źle | ✅ Dobrze | Dlaczego |
|---|---|---|
| `utm_source=TikTok` | `utm_source=tiktok` | Wielkie litery — niezgodność z resztą danych, w bazie policzy się jako inne źródło niż `tiktok` |
| `utm_source=fb` | `utm_source=facebook` | Skrót spoza listy — nie ma go w standardzie |
| `utm_source=tik-tok` | `utm_source=tiktok` | Wartość spoza zamkniętej listy |
| `utm_medium=social` | `utm_medium=organic_social` | `social` nie istnieje na liście — nie wiadomo, czy płatne czy nie |
| `utm_campaign=Start 2026` | `utm_campaign=start_2026_08` | Spacja i wielka litera; brakuje miesiąca |
| `utm_campaign=akcja-promocyjna` | `utm_campaign=promocje_bankowe_2026_09` | Myślnik zamiast `_`, brak roku/miesiąca, nazwa nieopisowa |
| `utm_content=film_1` | `utm_content=video_01` | Polskie słowo („film"), brak wiodącego zera |
| `utm_content=Post 1 – testowy` | `utm_content=post_01` | Spacje, wielkie litery, zbędny opis |
| `utm_term=` (pusty parametr w linku) | *(parametr całkowicie pominięty)* | Pusty `utm_term` w linku wygląda jak błąd, nie jak świadoma decyzja |

---

## Checklist przed opublikowaniem linku

1. `utm_source` — czy wartość jest z zamkniętej listy powyżej?
2. `utm_medium` — czy wartość jest z zamkniętej listy powyżej?
3. `utm_campaign` — czy ma format `{cel}_{RRRR}_{MM}`?
4. `utm_content` — czy jest potrzebny (więcej niż jeden materiał w tym
   źródle/kampanii)? Jeśli tak — czy ma format `{typ}_{numer}`?
5. `utm_term` — czy na pewno jest potrzebny? Jeśli nie — pomiń go całkowicie.
6. Całość — same małe litery, żadnych polskich znaków, żadnych spacji.

---

## Techniczne tło (dla kontekstu, nie do edycji przy każdej kampanii)

Serwis odczytuje te parametry z URL-a przy pierwszym wejściu w danej karcie
przeglądarki, zapisuje w `sessionStorage` (nie w cookie), i dołącza do
kliknięcia w przycisk „Przejdź do promocji" — trafiają wtedy do tabeli
`clicks` w bazie danych jako `utmSource` / `utmMedium` / `utmCampaign` /
`utmContent` / `utmTerm`. Mechanizm w pełni zweryfikowany i wdrożony
(zob. raporty DZIEŃ 1A).
