# TikTok 02 „Ile możesz zarobić” — pliki źródłowe

Film 1080 × 1920, 30 kl./s, ok. 39,8 s, w wyglądzie strony po redesignie v2 (ciemny granat, Exo 2 + Lexend,
kafle ofert jak na bankmiplaci.pl). Lektor: HeyGen „Bold Kasia”, tekst zatwierdzony przez właściciela.
Kompozycja Remotion: `BMP02-IleZarobic`. Ten folder nie jest częścią serwisu (wyłączony z `tsconfig.json`).

## Co zawiera

| Ścieżka | Co to |
|---|---|
| `remotion/src/BMP02/` | Film: `Film.tsx`, `scenes.tsx`, `ui.tsx`, `data.ts` (cały tekst i liczby na ekranie), `timeline.ts` + `words.ts` (czas z nagrania lektora) |
| `remotion/scripts/make-bmp02-audio.ts` | Lektor + własna muzyka i efekty → `public/bmp02/mix.wav` (−14 LUFS) |
| `remotion/scripts/make-bmp02-srt.ts` | Napisy SRT |
| `remotion/public/bmp02/logo-dark.png` | Logo (wersja na ciemne tło) |
| `bmp02-ile-zarobic.srt` | Gotowe napisy |

## Złożenie wersji z głosem (na komputerze, w `C:\Users\plyt8\Projekty\remotion-videos`)

1. Skopiuj `remotion/src/BMP02` do `src\BMP02`, `remotion/scripts/*` do `scripts\`, `remotion/public/bmp02` do `public\bmp02`.
2. W `src\Root.tsx` dopisz na górze:
   ```tsx
   import { BMP02Film } from "./BMP02/Film";
   import { DURATION as BMP02_DURATION, FPS as BMP02_FPS } from "./BMP02/timeline";
   ```
   i w środku `<>…</>` obok innych kompozycji:
   ```tsx
   <Composition id="BMP02-IleZarobic" component={BMP02Film} durationInFrames={BMP02_DURATION} fps={BMP02_FPS} width={1080} height={1920} />
   ```
3. Pobierz lektora i przekonwertuj (HeyGen zapisuje w pliku .wav dźwięk MP3):
   ```bash
   curl -L -o public/bmp02/voice_heygen.wav "https://resource2.heygen.ai/text_to_speech/620d53e0cf034e7693428f3b1280093e/ca09cfafab804c92911f685e04438e4e/id=9f613019-4f14-42d8-aa48-7938adf2bffa.wav"
   "C:/Users/plyt8/AppData/Local/CapCut/Apps/9.4.0.4015/ffmpeg.exe" -i public/bmp02/voice_heygen.wav -ac 1 -ar 44100 -c:a pcm_s16le public/bmp02/voice.wav
   ```
4. Dźwięk, napisy i render:
   ```bash
   node scripts/make-bmp02-audio.ts
   node scripts/make-bmp02-srt.ts
   npx remotion render BMP02-IleZarobic out/bmp02/bmp02-ile-zarobic.mp4 --gl=angle --codec=h264 --audio-codec=aac --crf=18 --pixel-format=yuv420p
   ```
   Skrypt dźwięku musi wypisać „Głośność: -14.0 LUFS” i nie może pisać „PODGLĄD BEZ LEKTORA”.

## Przed publikacją

- Sprawdź z aktualnymi regulaminami: kwoty i warunki 4 promocji (dane z weryfikacji 7.10, Alior II 18.10,
  Millennium 360° 28.10), czy PKO coś potrąca z nagród („kwoty są brutto”), czy przelew z własnego konta w innym
  banku spełnia warunek wpływu w Aliorze i Erste, daty wypłat w Erste. Po zmianie liczb popraw `data.ts`.
- Opublikuj artykuł z planem, do którego prowadzi link w bio. Na końcu filmu jest kafel „ściągi” w stylu strony;
  po publikacji artykułu można go zastąpić prawdziwym zrzutem ekranu.
- Oznaczenie: wszystkie 4 oferty mają aktywny link partnerski → opis zaczyna się od „REKLAMA”, przy publikacji
  „Ujawnienie treści” → „Treść markowa”. W filmie jest stały znacznik „REKLAMA”.
- Erste przyjmuje wnioski tylko do 30.11.2026 — film najpóźniej w połowie listopada.
