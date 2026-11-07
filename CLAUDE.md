# Bankmiplaci (bank-promo-comparator)

Porównywarka promocji bankowych w Polsce: oferty ze ściągą krok po kroku, ocena serwisu, panel admina z prowizjami afiliacyjnymi. Next 15 / React 19 / Tailwind / Prisma 5 / Postgres (Neon na produkcji), hosting Vercel, repo `plyt87124-gif/bankmiplaci`.

## Polecenia

- `npm run dev` serwer lokalny, `npm test` testy (muszą przechodzić wszystkie), `npx tsc --noEmit` typy, `npm run lint`.
- `npm run test:db` testy z bazą (wolniejsze, osobno). Lokalny build na Windowsie: `npm run build:win`.
- `npm run recompute:ratings` przelicza oceny serwisu. Na produkcji robi to właściciel skryptem `ProjektyKlaudia\bankmiplaci\bankmiplaci-ops\przelicz-oceny-prod.ps1`.

## Wdrażanie na produkcję (ważne)

- **Scalenie do `main` wdraża stronę na produkcję od razu** (Vercel). Dlatego:
  - nigdy nie pushuj bezpośrednio do `main` i nie rób force-push,
  - pracuj na osobnej gałęzi, zakładaj PR, scalaj dopiero po zielonych testach CI (`linux-build`),
  - **scalaj PR tylko wtedy, gdy właściciel wprost każe to zrobić w bieżącej rozmowie** (np. „scal”, „zrób, żeby było online”). Wcześniejsza zgoda na inny PR nie obowiązuje.
- Scalanie: `gh pr merge <numer> --merge` (zwykły merge commit, jak dotychczasowe PR-y). Właściciel zezwolił na to w `.claude/settings.local.json` (plik lokalny, nie jedzie na GitHub).
- Po scaleniu sprawdź na żywej stronie, że wdrożyła się nowa wersja (Vercel potrzebuje kilku minut).
- Zmiany w bazie produkcyjnej (migracje, `--apply`, przeliczanie ocen) wykonuje właściciel swoimi skryptami z `bankmiplaci-ops`. Nie uruchamiaj zapisów na produkcyjnej bazie bez wyraźnej prośby.

## Git

- Do commita dodawaj konkretne pliki, nie katalogi (w folderach bywają cudze, nieśledzone pliki z innych sesji). Nigdy `next-env.d.ts`.
- Duże zmiany rób w osobnym worktree (`.claude/worktrees/...`), żeby nie ruszać głównego folderu, w którym mogą być prace z innych sesji.
- Sekrety tylko w `.env*` (są w `.gitignore`), nigdy w commitach ani w odpowiedziach.

## Treść ofert (zasady właściciela, 7.11.2026)

Dotyczy każdej promocji, którą generujesz lub poprawiasz: plików `data/candidates/*.json`, generatorów `data/candidates/_src/gen_*.py`, importu, panelu admina.

- **Każdą rzecz mów raz.** Karencja (data graniczna albo liczba miesięcy) siedzi tylko w polach `cooldownCutoffDate` / `cooldownMonths`. Strona sama składa z nich skrót w pasku faktów i jedno zdanie w „Dla kogo jest promocja?”. `eligibleFor` i `notEligibleFor` mówią KTO (forma prawna, wiek, rodzaj klienta), bez powtarzania dat i okresów karencji, i nie są swoim lustrem („kto nie może” nie przepisuje „kto może” od końca). Właściciel zauważył, że ta sama informacja stała na stronie w trzech miejscach.
- **Zakazane zdania** (w żadnym polu, ani w szablonach strony): „Lista może zawierać także dodatkowe zasady i ograniczenia, a nie tylko czynności do wykonania.” oraz „Premia maksymalna nie jest gwarantowana – otrzymasz ją tylko po spełnieniu wszystkich warunków cząstkowych opisanych wyżej.” Pilnuje tego `src/lib/offerCopyRules.ts`: import przerywa się przed zapisem, formularz admina odmawia, `tests/offer-copy-rules.test.ts` skanuje `src/` i `data/`.
- Generator, który pisze nowe pliki z promocjami, ma te zasady zachować od razu. Nie liczysz na to, że zablokuje je dopiero import.

## Podgląd w przeglądarce Claude

`preview_start` czyta `.claude/launch.json` z głównego folderu. Żeby uruchomić podgląd z worktree, trzeba tymczasowo dodać wpis z `npm --prefix <worktree> run dev -- -p 3100` i po starcie przywrócić plik.
