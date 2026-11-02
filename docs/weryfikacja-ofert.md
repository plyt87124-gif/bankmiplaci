# Weryfikacja ofert co najwyżej co 2 dni

Cel: przy żadnej aktywnej ofercie data „Zweryfikowano” nie jest starsza niż 2 dni, a każda taka data ma za sobą rzeczywiste porównanie z dokumentami banku.

## Zasady

- **Data nie przesuwa się sama.** `Promotion.lastVerifiedAt` zmienia się tylko razem z rekordem `PromotionVerification` o wyniku `CONFIRMED` (`src/lib/services/verification.ts`, jedna transakcja), albo przy ręcznej edycji oferty w panelu lub przedłużeniu terminu (`scripts/extend-promotion.ts`).
- **Dwie metody potwierdzenia.**
  - `SOURCE_UNCHANGED`: wszystkie dokumenty oferty (regulamin, źródła dodatkowe, tabela opłat) mają dokładnie ten sam tekst co przy ostatnim potwierdzeniu (hash tekstu, bez znaczników i spacji). Robi to skrypt, bez człowieka.
  - `REVIEW`: ktoś (agent albo człowiek) przeczytał dokumenty i porównał z ofertą (daty, premia, warunki, grupa docelowa, opłaty). Opis „co z czym” jest obowiązkowy (`--note`).
- **Co nie potwierdza niczego:** dokument zmieniony względem ostatniego potwierdzenia, dokument nieodczytany (HTTP 403, strona ładowana skryptem, za mało tekstu), brak punktu odniesienia (pierwsze sprawdzenie). Wtedy data zostaje, a strona pokazuje prawdziwy wiek.
- **Czujka opóźnień:** `/api/cron/verification-watch` (codziennie 10:00 UTC) tworzy powiadomienie w panelu (typ `PROMOTION_CHECK_NEEDED`) i jeden e-mail dla każdej aktywnej, otwartej oferty ze starszą weryfikacją niż 36 h.
- **Strona:** `fresh` do 2 dni, przy 3 dniach znacznik stonowany, po 3 dniach „dane mogą być nieaktualne” (`src/lib/freshness.ts`). Opis dla czytelników: `/metodologia#weryfikacja`.

## Polecenia

```bash
npx tsx scripts/verify-offers.ts status                         # wiek weryfikacji każdej oferty
npx tsx scripts/verify-offers.ts show <slug>                    # co strona mówi o ofercie
npx tsx scripts/verify-offers.ts text <slug> --out <katalog>    # teksty dokumentów do przeczytania
npx tsx scripts/verify-offers.ts plan [--apply]                 # dokumenty vs ostatnie potwierdzenie; --apply zapisuje UNCHANGED
npx tsx scripts/verify-offers.ts confirm <slug> --note "..." [--browser-read <url>] --apply
npx tsx scripts/verify-offers.ts flag <slug> --result CHANGED|UNREACHABLE --note "..." --apply
```

Domyślnie sucha próba; baza inna niż lokalna wymaga `--allow-remote`. `plan` nigdy nie zapisuje nic poza ofertami `UNCHANGED`.

## Codzienny agent

Zadanie `bankmiplaci-verify-offers` (Claude, Zaplanowane zadania) uruchamia `plan --apply`, a dla ofert, które tego wymagają, czyta dokumenty i robi `confirm` albo `flag`. Niczego w ofertach nie poprawia: różnice zgłasza (`flag`), a właściciel decyduje. Raport trafia mailem do `ADMIN_EMAIL`.

## Ograniczenia

- Niezmieniony dokument dowodzi, że warunki w dokumencie się nie zmieniły. Nie dowodzi, że bank nie zakończył promocji komunikatem na stronie albo wyczerpaniem puli. Dlatego `REVIEW` obejmuje też strony promocyjne banku, a metodologia mówi wprost, że data nie wyklucza zmiany po tym dniu.
- Źródła, których skrypt nie odczyta (np. Revolut: HTTP 403), wymagają codziennego `REVIEW` z `--browser-read`.
- Zadanie działa na komputerze właściciela. Gdy nie ruszy, czujka zgłosi opóźnienie po 36 h, a strona sama pokaże starszą datę.

## Wycofanie

Tabela `promotion_verifications` jest tylko dziennikiem: usunięcie wierszy nie zmienia ofert. Aby wyłączyć mechanizm: wyłącz zadanie `bankmiplaci-verify-offers` i usuń wpis crona z `vercel.json`.
