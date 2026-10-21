# TikTok 01 „Alior Konto z Premią”: pliki źródłowe filmu

Film pionowy 1080 × 1920, 30 kl./s, ok. 35,4 s, z lektorem HeyGen „Bold Kasia”. Kod to Remotion
(projekt `C:\Users\plyt8\Projekty\remotion-videos`). Ten folder służy tylko do przeniesienia plików
i nie jest częścią serwisu (wyłączony z `tsconfig.json`).

Projekt powstał w dwóch sesjach. Pierwsza (lokalna) przygotowała pliki bazowe, lektora, zrzut strony
i weryfikację faktów. Druga (w chmurze) zbudowała 6 scen i skrypt dźwięku.

## Zawartość

| Ścieżka | Co to jest |
|---|---|
| `remotion/src/BankMiPlaci/` | Cały film: `Film.tsx`, 6 scen w `scenes/`, `promo.ts` (tekst na ekranie), `timeline.ts` (czas), motyw, obrączka 3D, napisy |
| `remotion/scripts/make-bmp01-audio.ts` | Montaż lektora + własna muzyka i efekty → `public/bmp01/mix.wav` (−14 LUFS, true peak ≤ −1 dBTP) |
| `remotion/scripts/make-bmp01-srt.ts` | Plik SRT z tych samych okien co napisy w obrazie |
| `bmp01-alior.srt` | Gotowe napisy SRT |
| `opis-publikacji.txt` | Opis do TikToka |

## Jak złożyć finalny film na komputerze

Na PC są już pliki, których nie ma w tym folderze: `public/bmp01/voice_src.wav` (lektor) i
`public/bmp01/page_full.png` (prawdziwy zrzut strony). Nie nadpisuj ich.

1. Skopiuj `remotion/src/BankMiPlaci/` do `remotion-videos\src\BankMiPlaci\`, a `remotion/scripts/*`
   do `remotion-videos\scripts\` (z nadpisaniem). `Root.tsx` zostaje bez zmian, bo kompozycja `BMP01-Alior`
   jest już zarejestrowana.
2. W `remotion-videos`:

   ```bash
   node scripts/make-bmp01-audio.ts
   node scripts/make-bmp01-srt.ts
   npx remotion render BMP01-Alior out/bmp01-alior/bmp01-alior.mp4 --gl=angle --codec=h264 --audio-codec=aac --crf=18 --pixel-format=yuv420p
   ```

   Skrypt dźwięku wypisze głośność, poziom muzyki pod lektorem w każdej scenie (cel ok. 19 dB)
   i ostrzeżenia o cięciach lektora poza ciszą.
3. Obejrzyj cały render z dźwiękiem i bez niego.

## Co sprawdzono w chmurze, a czego nie

- Każdą scenę obejrzano na klatkach kontrolnych: strefy bezpieczne TikToka, maks. 2 linie napisów,
  „DO” przy każdym „800 ZŁ”, nieruchome karty warunków przez ostatnie ~2 s sceny, końcowy kadr ≥ 2 s.
- Skrypt dźwięku przetestowano na głosie zastępczym. Pomiar głośności zgadza się z `ffmpeg ebur128`
  (−14,0 LUFS). Poziomy muzyki kalibrują się automatycznie do prawdziwego lektora.
- **Nie sprawdzono** brzmienia z prawdziwym lektorem. Podgląd z chmury nie miał lektora ani pełnego
  zrzutu strony, bo sieć sesji blokowała `resource2.heygen.ai` i `bankmiplaci.pl`. Scena końcowa
  używała zrzutu złożonego z fragmentów.

## Przed publikacją

- Strona docelowa pokazuje nieaktualny koszt karty (300 zł / 6 zł zamiast 5 płatności / 7 zł).
  Popraw ją przed publikacją, bo film odsyła do „pełnych zasad i kosztów”.
- Termin: umowa do 13.10.2026 lub do wcześniejszego wyczerpania nagród. Po tej dacie filmu nie publikować.
