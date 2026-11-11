// BMP02 „Ile możesz zarobić” — czas wszystkiego z nagrania lektora HeyGen „Bold Kasia”
// (word_timestamps zwrócone przez create_speech, request ea260ad1f4644541aeecb1e1cb67f10e, 38,19 s).
// Nagranie bez montażu: public/bmp02/voice.wav leci od klatki 0. Obraz, napisy, SRT i miks czytają ten plik.
import { WORDS_RAW } from "./words.ts";

export const FPS = 30;
export const VOICE_URL =
  "https://resource2.heygen.ai/text_to_speech/620d53e0cf034e7693428f3b1280093e/ca09cfafab804c92911f685e04438e4e/id=9f613019-4f14-42d8-aa48-7938adf2bffa.wav";
export const VOICE_SECONDS = 38.191;

export type Word = { text: string; start: number; end: number };
export const WORDS: Word[] = WORDS_RAW.map(([text, start, end]) => ({ text, start, end }));

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** indeks n-tego wystąpienia słowa (po normalizacji) */
export const wi = (word: string, nth = 1): number => {
  let seen = 0;
  for (let i = 0; i < WORDS.length; i++) {
    if (norm(WORDS[i].text) === norm(word) && ++seen === nth) return i;
  }
  throw new Error(`Brak słowa ${word} #${nth}`);
};
/** klatka początku słowa */
export const ws = (word: string, nth = 1) => Math.round(WORDS[wi(word, nth)].start * FPS);
/** klatka końca słowa */
export const we = (word: string, nth = 1) => Math.round(WORDS[wi(word, nth)].end * FPS);

export const TAIL = Math.round(1.6 * FPS); // końcowy kadr stoi jeszcze ok. 1,6 s po ostatnim słowie (łącznie ≥ 2 s z „Link w bio”)
export const DURATION = Math.round(VOICE_SECONDS * FPS) + TAIL;

// Kotwice
export const K = {
  hook: 0,
  fourAccounts: ws("Cztery"),
  oneSalary: ws("jedna"),
  millennium: ws("Millennium"),
  milSalary: ws("wpływa"),
  milCard: ws("kartą", 1),
  alior: ws("Alior"),
  aliorPay: ws("Pięć"),
  aliorTransfer: ws("przelew"),
  erste: ws("Erste"),
  ersteDeadline: ws("wniosek"),
  pko: ws("PKO"),
  pkoPercent: ws("dziesięć"),
  premie: ws("Premie"),
  grudnia: ws("grudnia"),
  czerwca: ws("czerwca"),
  haczyk: ws("Haczyk"),
  conditions: ws("Co", 2),
  plan: ws("Cały"),
  url: ws("bank", 1),
  link: ws("Link"),
};

const LEAD = 6; // obraz zmienia się kilka klatek przed słowem
export const SCENES = {
  hook: { from: 0, to: K.millennium - LEAD },
  banks: { from: K.millennium - LEAD, to: K.premie - LEAD },
  calendar: { from: K.premie - LEAD, to: K.haczyk - LEAD },
  catch: { from: K.haczyk - LEAD, to: K.plan - LEAD },
  end: { from: K.plan - LEAD, to: DURATION },
} as const;
export type SceneId = keyof typeof SCENES;
export const TRANSITION = 10;

/** klatka globalna → klatka od początku sceny */
export const local = (scene: SceneId, frame: number) => frame - SCENES[scene].from;

// Napisy: krótkie frazy (indeksy słów od–do włącznie), **x** = wyróżnienie
const CAP: { from: number; to: number; text: string }[] = [
  { from: wi("Do"), to: wi("roku"), text: "Do **2 900 zł** przez pół roku." },
  { from: wi("Cztery"), to: wi("pensja", 1), text: "**Cztery konta**, jedna pensja." },
  { from: wi("Millennium"), to: wi("złotych", 2), text: "Millennium: do **800 zł**." },
  { from: wi("Tu"), to: wi("miesięcznie"), text: "Tu wpływa pensja, a kartą płacisz **1 000 zł** miesięcznie." },
  { from: wi("Alior"), to: wi("ośmiuset", 2), text: "Alior: do **800 zł**." },
  { from: wi("Pięć"), to: wi("miesiąc", 1), text: "**5 płatności** i przelew **1 000 zł** co miesiąc." },
  { from: wi("Erste"), to: wi("siedmiuset"), text: "Erste: do **700 zł**," },
  { from: wi("ale"), to: wi("listopada"), text: "ale wniosek tylko do **30 listopada**." },
  { from: wi("PKO"), to: wi("sześciuset"), text: "PKO: do **600 zł** —" },
  { from: wi("dziesięć"), to: wi("kartą", 2), text: "**10% zwrotu** za płatności kartą." },
  { from: wi("Premie"), to: wi("czerwca"), text: "Premie wpływają **od grudnia do czerwca**." },
  { from: wi("Haczyk"), to: wi("Haczyk"), text: "**Haczyk?**" },
  { from: wi("Co", 2), to: wi("bankach"), text: "Co miesiąc pilnujesz warunków w **4 bankach**." },
  { from: wi("Cały"), to: wi("el"), text: "Cały plan: **bankmiplaci.pl**" },
  { from: wi("Link"), to: wi("bio"), text: "Link w bio." },
];

export const CAPTION_WINDOWS = CAP.map((c, i) => {
  const start = Math.round(WORDS[c.from].start * FPS) - 2;
  const ownEnd = Math.round(WORDS[c.to].end * FPS) + 12;
  const next = CAP[i + 1] ? Math.round(WORDS[CAP[i + 1].from].start * FPS) - 2 : DURATION;
  return { text: c.text, start, end: Math.min(ownEnd, next) };
});

export type SfxKind = "amount" | "whoosh" | "tick" | "pop" | "coin" | "soft" | "alert";
export const SFX: { f: number; kind: SfxKind; gain?: number }[] = [
  { f: 0, kind: "amount", gain: 1 },
  { f: K.fourAccounts, kind: "tick", gain: 0.5 },
  { f: K.oneSalary, kind: "tick", gain: 0.5 },
  { f: SCENES.banks.from, kind: "whoosh", gain: 0.45 },
  { f: ws("ośmiuset", 1), kind: "pop", gain: 0.6 },
  { f: K.alior - 3, kind: "whoosh", gain: 0.4 },
  { f: ws("ośmiuset", 2), kind: "pop", gain: 0.6 },
  { f: K.erste - 3, kind: "whoosh", gain: 0.4 },
  { f: ws("siedmiuset"), kind: "pop", gain: 0.6 },
  { f: K.ersteDeadline, kind: "alert", gain: 0.45 },
  { f: K.pko - 3, kind: "whoosh", gain: 0.4 },
  { f: ws("sześciuset"), kind: "pop", gain: 0.6 },
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ f: K.grudnia + i * 4, kind: "coin" as SfxKind, gain: 0.35 })),
  { f: K.haczyk, kind: "alert", gain: 0.55 },
  { f: SCENES.end.from, kind: "soft", gain: 0.5 },
  { f: K.url, kind: "pop", gain: 0.5 },
];
