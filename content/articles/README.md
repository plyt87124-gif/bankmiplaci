# Artykuły (content/articles)

Każdy artykuł to plik `<slug>.md`: nagłówek między liniami `---` i treść w markdownie. Pliki trafiają do bazy poleceniem `npm run import:articles`; zmiany przechodzą przez pull request jak kod.

## Nagłówek

```yaml
---
title: ""                      # do 60 znaków (przed „| Bankmiplaci”), główne zapytanie na początku
slug: ""                       # taki jak nazwa pliku; małe litery, cyfry, myślniki
category: PORADNIKI            # PROMOCJE_BANKOWE | KONTA_BANKOWE | FINANSE_OSOBISTE | CASHBACK | PORADNIKI
excerpt: ""                    # do 155 znaków, odpowiedź (nie zajawka), służy za meta description
zapytanie_glowne: ""           # jedno zapytanie na jeden adres
zapytania_poboczne: []
promotionSlug: ""              # opcjonalnie: oferta, której tekst jest przewodnikiem (pominięte = zostaje obecne powiązanie)
wazna_do: ""                   # RRRR-MM-DD, jeśli tekst dotyczy promocji z terminem
stan_na: ""                    # RRRR-MM-DD, data sprawdzenia liczb (wymagana przy published: true)
published: false
---
```

`wazna_do` i `stan_na` służą redakcji i rejestrowi treści, nie są zapisywane w bazie. Pola spoza listy są błędem (literówki nie przechodzą po cichu).

## Zasady importu

- **Próba, potem zapis.** `npm run import:articles` niczego nie zapisuje i pokazuje, co by się zmieniło. Dopiero `npm run import:articles -- --apply` zapisuje.
- **Wszystko albo nic.** Błąd w jednym pliku przerywa cały import przed zapisem.
- **Szkic domyślnie.** Brak `published: true` oznacza szkic, niewidoczny publicznie.
- **Nie cofa publikacji.** Plik z `published: false` dla już opublikowanego artykułu jest błędem. Cofnięcie robi się świadomie w panelu.
- **Uczciwe daty.** „Opublikowano” ustawia się raz, przy pierwszej publikacji. „Zaktualizowano” zmienia się tylko wtedy, gdy tytuł, zajawka, treść lub kategoria już opublikowanego artykułu naprawdę się zmieniły.
- **Autor.** Nowy artykuł dostaje konto administratora (`--author-email=` albo najstarsze konto ADMIN). Konto ogólne („Administrator”) jest pokazywane jako „Redakcja Bankmiplaci”. Autora istniejącego artykułu import nie zmienia.
- **Idempotencja.** Ponowny import niezmienionego pliku nic nie zmienia.

Produkcyjny import uruchamia właściciel po przeczytaniu raportu próby. Szablon i lista kontrolna przed oddaniem są w repozytorium `bankmiplaci-seo-agent` (`tresci/TEMPLATE-artykul.md`).
