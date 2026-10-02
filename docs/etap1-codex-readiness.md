# Dodatkowa kontrola przed wdrożeniem — 2 października 2026

Gałąź `fix/etap1-codex-readiness` rozszerza przyjęty stan funkcjonalny
`c4f28434e0769d1d0cb65815c1e69d8c4ada9af5`. PR #1 i `main` nie są zmieniane.
To propozycja do przeglądu; nie wykonano migracji, merge'a, wdrożenia ani korekt
danych na produkcji. Vercel Preview jest wyłączony także dla nowej gałęzi,
ponieważ konfiguracja projektu Preview korzysta z produkcyjnej bazy.

## Przyczyna dodatkowej zmiany

Dotychczasowy `next@14.2.15` ma znane luki. Samo przejście na `14.2.35`
nie usuwa nowszych zgłoszeń dotyczących App Router i Server Actions.
Komunikat producenta z lipca 2026 dla GHSA-m99w-x7hq-7vfj wymaga aktualizacji,
a komunikat z sierpnia dla GHSA-2xp9-vwfh-vxw4 wskazuje poprawkę w 15.5.24.

Wybrano aktualną poprawioną linię 15.x: `next` i `eslint-config-next` 15.5.27,
React/React DOM oraz ich typy 19.3.0. PostCSS 8.5.28 jest przypięty i
wymuszony przez `overrides`, również dla zależności Next.js. Nie uruchamiano
`npm audit fix --force`.

Źródła producenta:

- https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj
- https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
- https://nextjs.org/docs/app/guides/upgrading/version-15

## Zmiany zgodności

Oficjalny `next-async-request-api` codemod i przegląd ręczny dostosowały
`params`, `searchParams` oraz `cookies()` do API asynchronicznego. Wylogowanie
czeka na usunięcie cookie przed zwróceniem odpowiedzi. Refy mają jawne wartości
początkowe wymagane przez typy React 19. Reguły opłat, dat, karencji, ściągi,
afiliacji i importu pozostają takie same. Schema i pięć migracji etapu 1 nie są
zmieniane.

Test HTTP obejmuje dodatkowo logowanie użytkownika testowego, odczyt `/konto`
z cookie, usunięcie cookie przy wylogowaniu, parametry strony porównania oraz
trasę komentarzy. Użytkownik jest wyłącznie w tymczasowej bazie CI
(`example.test`) i jest usuwany po kontroli. Nie są wysyłane e-maile.
CI sprawdza także `npm audit --omit=dev --audit-level=high`.

## Instrukcja wykonawcza

Instrukcja pozostaje osobnym dokumentem poza repozytorium. Dodatkowa kontrola
PowerShell wykazała potrzebę zatrzymania po błędnym `vercel env pull`, błędzie
dry-runu i braku programu oraz po błędzie zapisu spisu archiwum. Poprawiona
wersja zawiera te warunki i chroni podawanie adresu bazy przed zapisaniem
hasła jako literalnej wartości w historii powłoki.

Nie należy wykonywać wdrożenia na podstawie starego SHA z tej instrukcji.
Po akceptacji tej gałęzi i połączeniu zmian z etapem 1 trzeba odświeżyć
instrukcję do faktycznego zaakceptowanego SHA, linku CI i stanu PR. Liczba
migracji oraz ich kolejność pozostają bez zmian. Dotychczasowe zasady
potwierdzenia kopii bazy, flaga Erste i ograniczenia rollbacku nadal obowiązują.

## Wyniki i ograniczenia

Lokalnie przeszły: typecheck, 49 testów hermetycznych, audyt zależności
produkcyjnych (0 zgłoszeń) oraz `next build --experimental-build-mode compile`.
Tryb `compile` nie wykonuje pełnego prerenderowania ani weryfikacji połączenia
z bazą. Pełne testy na prawdziwym PostgreSQL, migracje, zwykły produkcyjny build
i kontrola HTTP muszą zostać wykonane w CI tej gałęzi. Wynik musi odnosić się
do jej aktualnego SHA; zielone CI dla `c4f2843` nie potwierdza nowej aktualizacji.

Sprawdzenie PowerShell używało wersji 7.6.6 na Linuxie, atrap poleceń
zewnętrznych i plików tymczasowych. Nie potwierdza zachowania paneli Neon i
Vercel, Windows PowerShell 5.1 ani rzeczywistej kopii danych produkcyjnych.
