/**
 * Tones of the page background on /konto (see AccountAmbient.tsx and
 * `.konto-ambient` in globals.css). Each part of the page that has its own
 * content carries `data-ambient-tone="<name>"`; the background takes the tone of
 * the part that is in the middle of the screen. The tones are a few quiet hues:
 * the page changes colour a little, it does not change mood.
 */
export const AMBIENT_START = "start";
export const AMBIENT_SETTINGS = "ustawienia";
export const AMBIENT_HISTORY = "historia";

/** The ściągi take turns in three tones (sciaga-0, sciaga-1, sciaga-2), so two neighbours never share one. */
export const SCIAGA_TONE_COUNT = 3;

export function ambientToneForCard(index: number): string {
  return `sciaga-${((index % SCIAGA_TONE_COUNT) + SCIAGA_TONE_COUNT) % SCIAGA_TONE_COUNT}`;
}
