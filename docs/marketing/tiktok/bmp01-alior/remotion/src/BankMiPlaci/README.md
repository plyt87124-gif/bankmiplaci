# BankMiPłaci — TikTok 01 „Alior Konto z Premią”

Pionowy film 1080×1920, 30 kl./s, ok. 35 s. Kompozycja `BMP01-Alior` w Remotion.

## Jak to jest zbudowane

| Plik | Co zawiera |
|---|---|
| `promo.ts` | **Cały tekst na ekranie** (kwoty, warunki, kod, daty, adres). Schemat zod, więc pola da się też edytować w Remotion Studio (panel *Props*). |
| `timeline.ts` | **Czas wszystkiego.** Frazy nagrania lektora (`RAW`: tekst, miejsce w surowym nagraniu, pauza przed frazą), z nich: sceny (`SCENES`), napisy (`CAPTIONS`), efekty dźwiękowe (`SFX`). Obraz, napisy, SRT i miks audio czytają ten sam plik. |
| `scenes/*.tsx` | Sześć scen: Hook (kwota + obrączka 3D + terminal), Payout (oś wypłat), Conditions (warunki + opłata za kartę), Form (wniosek + kod), Eligibility (dla kogo + termin), EndCard (prawdziwy zrzut strony + CTA). |
| `Ring3D.tsx` | Obrączka 3D (three.js). |
| `theme.ts`, `ui.tsx`, `Background.tsx`, `Captions.tsx`, `Film.tsx` | Marka (kolory i fonty jak na bankmiplaci.pl), strefy bezpieczne TikToka, wspólne klocki, przejścia. |
| `../../scripts/make-bmp01-audio.ts` | Montaż lektora + własna muzyka i efekty (syntezowane, bez licencji) → `public/bmp01/mix.wav`. |
| `../../scripts/make-bmp01-srt.ts` | Plik SRT z tych samych okien co napisy w obrazie. |

Głos: HeyGen „Bold Kasia” (`ca09cfafab804c92911f685e04438e4e`). To ten sam głos co w referencji „Alior 800 zł — TikTok #2”.

## Podmiana promocji (nowy film na tym szablonie)

1. Sprawdź aktualny regulamin i taryfę banku. Nie przepisuj danych z pamięci.
2. Napisz nowy tekst lektora i wygeneruj go w HeyGen tym samym głosem. Zapisz jako `public/bmpXX/voice_raw.wav` i przekonwertuj do PCM:
   `ffmpeg -i voice_raw.wav -ac 1 -ar 44100 -c:a pcm_s16le voice_src.wav`
3. Wykryj frazy: `ffmpeg -i voice_src.wav -af silencedetect=n=-40dB:d=0.12 -f null -`. Wpisz je do `RAW` w `timeline.ts` (tekst + `src` od końca ciszy do początku następnej) i ustaw pauzy.
4. Popraw teksty w `promo.ts` i zrób nowy zrzut strony docelowej (widok mobilny 390 px, DPR 3). Zrzut ma pokazywać aktualne warunki.
5. `node scripts/make-bmp01-audio.ts` → `node scripts/make-bmp01-srt.ts` → render (niżej).

## Render

```bash
npx remotion render BMP01-Alior out/bmp01-alior/bmp01-alior.mp4 --gl=angle --codec=h264 --audio-codec=aac --crf=18 --pixel-format=yuv420p
```

`--gl=angle` jest potrzebne dla obrączki 3D (WebGL w trybie headless).

## Stan danych

Sprawdzone 2026-10-04 z regulaminem „Alior Konto z Premią” (obowiązuje od 13.07.2026), stroną produktu Alior Konto (stan na 13.07.2026) i Taryfą od 1.06.2026. Promocja kończy się 13.10.2026 (trzeba **zawrzeć umowę**) albo wcześniej, jeśli wyczerpie się pula nagród. Po tej dacie filmu nie publikować.
