# Dzienna kontrola ofert eBrokerPartner — jak to działa

Stan: 7.10.2026, **tylko lokalnie** (migracje zastosowane na lokalnej bazie, nic na produkcji).

## Co robi automat

Dwie warstwy, bo katalog eBroker nie zawiera dat, edycji ani opłat:

1. **Wykrywanie (serwer, bez AI)** — `/api/cron/ebroker-watch` (Vercel Cron, 04:30) lub lokalnie
   `npx tsx scripts/ebroker-watch.ts run`. Pobiera publiczny katalog XML, porównuje z tabelą
   `ebroker_campaigns` i tworzy powiadomienia w panelu admina (dzwonek „Zmiany w ofertach") oraz jeden
   e-mail zbiorczy na `ADMIN_EMAIL`:
   - nowa kampania konta osobistego/firmowego,
   - zmiana opisu kampanii,
   - kampania zniknęła z katalogu (to NIE znaczy, że promocja się skończyła),
   - promocja po terminie, której kampania nadal jest w katalogu → „sprawdź przedłużenie/nową edycję",
   - katalog wygląda na niepełny (wtedy żadna kampania nie jest oznaczana jako usunięta).
   Wygaszanie promocji (`/api/cron/expire-promotions`) też tworzy powiadomienie „Promocja wygasła".
2. **Uzupełnianie treści (Claude, zadanie zaplanowane `bankmiplaci-ebroker-daily`)** — czyta ofertę
   i regulamin banku, pisze opis, warunki, opłaty i ściągę, dodaje promocję (lokalnie ACTIVE,
   `--notify` = powiadomienie + e-mail) oraz sprawdza przedłużenia z dowodem z regulaminu.
   Link afiliacyjny bierze z katalogu (`<url>` kampanii) — logowanie do panelu nie jest potrzebne.

## Zasady (nie do negocjacji)
- Nic nie jest wymyślane: brak pewności = pole puste (opłata „Nieustalone").
- Obecność/zniknięcie kampanii nigdy samo nie zmienia statusu promocji.
- Przedłużenie tylko z adresem dowodu (`scripts/extend-promotion.ts --evidence`).
- Ostatni dzień promocji jest włączony (Europa/Warszawa) — w całym kodzie przez `promotionAvailability.ts`.
- W ściądze jest jeden wiersz nagrody na grupę miesiąca (UI liczy tylko pierwszy); generator scala resztę.

## Polecenia
```
npx tsx scripts/ebroker-watch.ts run [--file feed.xml]   # jedna kontrola
npx tsx scripts/ebroker-watch.ts pending                 # kampanie bez promocji (JSON)
npx tsx scripts/ebroker-watch.ts link                    # powiąż znane promocje (data/ebroker-campaign-map.json)
npx tsx scripts/ebroker-watch.ts skip                    # kampanie bez własnej promocji (data/ebroker-skip.json)
npx tsx scripts/add-promotion-with-checklist.ts <plik.json> [--apply] [--active] [--notify]
npx tsx scripts/extend-promotion.ts <slug> <RRRR-MM-DD> --evidence <https://…> [--apply] [--notify]
```
`--active` jest dozwolone tylko na localhost, chyba że dodasz `--allow-active-remote`.

## Co trzeba zrobić, żeby uruchomić to na produkcji (osobna zgoda)
1. Zastosować migracje `20261007120000_ebroker_watch` i `20261007130000_ebroker_campaign_skip_reason`
   (dodają typy powiadomień, tabelę `ebroker_campaigns`, kolumny `dedupKey` i `skipReason`).
2. Ustawić w Vercel: `CRON_SECRET`, `ADMIN_EMAIL`, `RESEND_API_KEY`, `EMAIL_FROM` (opcjonalnie `EBROKER_CATALOG_URL`).
3. Uruchomić `ebroker-watch.ts run` (pierwszy przebieg = baseline, bez powiadomień), potem `link` i `skip`
   (mapa oid→slug dla 10 aktywnych promocji jest w `data/ebroker-campaign-map.json`).
4. W zadaniu zaplanowanym ustawić godzinę i — świadomie — bazę produkcyjną (`DATABASE_URL`) oraz
   `--allow-active-remote`. Zadanie działa tylko, gdy aplikacja Claude jest otwarta.

## Znane ograniczenia
- Regulaminy w PDF bywają uszkodzone (np. Pekao „edycja IV") — wtedy kwoty są ze strony oferty i jest to
  zaznaczone w `_comment` kandydata.
- Kampanie z ofertami lokat (VeloBank Gold/Private Wealth) i konta bez premii czekają w `ebroker-skip.json`
  z oznaczeniem „DECYZJA".
