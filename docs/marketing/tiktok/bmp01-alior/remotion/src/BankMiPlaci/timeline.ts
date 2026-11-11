// Jedno źródło prawdy dla obrazu, napisów, SRT i miksu audio (node scripts/make-bmp01-audio.ts).
// Czasy liczone są z nagrania lektora, nie odwrotnie: zmiana tekstu = nowe nagranie + nowe SEGMENTS.
//
// Lektor: HeyGen "Bold Kasia" (ca09cfafab804c92911f685e04438e4e, silnik orca) — ten sam głos co referencja
// "Alior 800 zł — TikTok #2 (białe tło)". Surowe nagranie: public/bmp01/voice_src.wav (PCM 44.1 kHz mono).
// Granice fraz wykryte przez silencedetect (-40 dB, min. 0,12 s). Montaż skraca pauzy między frazami
// (PAUSE_BEFORE), więc głos zachowuje naturalne tempo, a film się nie dłuży.

export const FPS = 30;

type Seg = { id: string; text: string; src: [number, number]; pause: number };

// pause = cisza PRZED frazą w zmontowanym głosie (s)
const RAW: Seg[] = [
  { id: "A", text: "Do ośmiuset złotych i obrączka,", src: [0.312, 2.057], pause: 0.12 },
  { id: "B", text: "którą zapłacisz za zakupy?", src: [2.372, 3.74], pause: 0.315 },
  { id: "C", text: "Sprawdźmy.", src: [4.308, 4.899], pause: 0.4 },
  { id: "D", text: "W Alior Koncie z Premią:", src: [5.556, 6.874], pause: 0.42 },
  { id: "E", text: "dwieście na start,", src: [7.247, 8.208], pause: 0.22 },
  { id: "F", text: "dwieście za aktywność", src: [8.581, 9.8], pause: 0.2 },
  { id: "G", text: "i do czterech razy po sto.", src: [10.139, 11.38], pause: 0.18 },
  { id: "H", text: "Co trzeba zrobić?", src: [12.108, 12.936], pause: 0.42 },
  { id: "I", text: "Przez pięć miesięcy,", src: [13.373, 14.48], pause: 0.3 },
  { id: "J", text: "co miesiąc:", src: [14.845, 15.54], pause: 0.18 },
  { id: "K", text: "trzy płatności,", src: [15.88, 16.881], pause: 0.2 },
  { id: "L", text: "wpływ minimum tysiąca złotych z innego banku", src: [17.236, 19.741], pause: 0.2 },
  { id: "M", text: "i logowanie do apki.", src: [20.146, 21.228], pause: 0.2 },
  // dłuższa pauza: karty warunków stoją nieruchomo ~2 s (brief), widz doczytuje opłatę za kartę
  { id: "N", text: "Otwierasz konto z kartą online,", src: [22.077, 23.777], pause: 1.1 },
  { id: "O", text: "wpisujesz kod premia dwa tysiące dwadzieścia sześć", src: [24.072, 26.507], pause: 0.2 },
  { id: "P", text: "i dajesz wymagane zgody.", src: [26.906, 28.175], pause: 0.2 },
  { id: "Q", text: "Oferta dla nowych klientów,", src: [28.602, 30.178], pause: 0.4 },
  { id: "R", text: "tylko do trzynastego października.", src: [30.566, 32.248], pause: 0.2 },
  { id: "S", text: "Pełne zasady i koszty:", src: [32.961, 34.205], pause: 0.45 },
  { id: "T", text: "bank mi płaci kropka pe el.", src: [34.551, 36.134], pause: 0.22 },
  { id: "U", text: "Link w bio.", src: [36.587, 37.242], pause: 0.3 },
];

export type VoiceSeg = Seg & { out: [number, number] };

export const VOICE: VoiceSeg[] = (() => {
  let cursor = 0;
  return RAW.map((s) => {
    const start = cursor + s.pause;
    const end = start + (s.src[1] - s.src[0]);
    cursor = end;
    return { ...s, out: [start, end] as [number, number] };
  });
})();

// zapas audio wokół wykrytej mowy (początki spółgłosek, wybrzmienia)
export const VOICE_PAD = { pre: 0.05, post: 0.09 };

const byId = Object.fromEntries(VOICE.map((s) => [s.id, s]));
export type SegId = (typeof RAW)[number]["id"];

/** klatka (zaokrąglona) w ułamku `frac` frazy `id` w zmontowanym nagraniu */
export const at = (id: SegId, frac = 0): number => {
  const s = byId[id];
  if (!s) throw new Error(`Brak frazy ${id}`);
  return Math.round((s.out[0] + (s.out[1] - s.out[0]) * frac) * FPS);
};
export const endOf = (id: SegId) => at(id, 1);

// Pozycje słów wewnątrz fraz (szacunek z obwiedni nagrania, ±3 klatki).
export const WORD = {
  obraczka: at("A", 0.65),
  zaplacisz: at("B", 0.26),
  zakupy: at("B", 0.69),
  premia: at("O", 0.315), // "premia" (kod)
  kod2026: at("O", 0.51), // "dwa tysiące dwadzieścia sześć"
  kodKoniec: at("O", 0.98),
  zgody: at("P", 0.62),
};

export const VOICE_END = endOf("U");
export const TAIL = Math.round(1.2 * FPS); // końcowy kadr stoi jeszcze ~1,2 s po ostatnim słowie
export const DURATION = VOICE_END + TAIL;

// Sceny: obraz zmienia się kilka klatek PRZED pierwszym słowem nowej części.
const LEAD = 8;
export const SCENES = {
  hook: { from: 0, to: at("D") - LEAD }, // DO 800 ZŁ + obrączka + terminal + "Sprawdźmy."
  payout: { from: at("D") - LEAD, to: at("H") - LEAD }, // oś wypłat 200 / 200 / 4×100
  conditions: { from: at("H") - LEAD, to: at("N") - LEAD }, // 3 warunki co miesiąc przez 5 miesięcy
  form: { from: at("N") - LEAD, to: at("Q") - LEAD }, // wniosek online + PREMIA2026 + zgody
  eligibility: { from: at("Q") - LEAD, to: at("S") - LEAD }, // dla kogo + termin
  end: { from: at("S") - LEAD, to: DURATION }, // prawdziwa strona BankMiPłaci + CTA
} as const;
export type SceneId = keyof typeof SCENES;
export const TRANSITION = 10; // klatek nakładania sąsiednich scen

/** klatka frazy `id` liczona od początku sceny `scene` (do animacji wewnątrz sceny) */
export const local = (scene: SceneId, frame: number) => frame - SCENES[scene].from;

// Napisy lektorskie: maks. 2 linie, krótkie frazy. **x** = wyróżnienie (liczby, słowa kluczowe).
export const CAPTIONS: { from: SegId; to?: SegId; text: string }[] = [
  { from: "A", text: "Do **800 zł** i **obrączka**," },
  { from: "B", text: "którą zapłacisz za zakupy?" },
  { from: "C", text: "**Sprawdźmy.**" },
  { from: "D", text: "W **Alior Koncie z Premią**:" },
  { from: "E", text: "**200 zł** na start," },
  { from: "F", text: "**200 zł** za aktywność" },
  { from: "G", text: "i do **4 × 100 zł**." },
  { from: "H", text: "Co trzeba zrobić?" },
  { from: "I", to: "J", text: "Przez **5 miesięcy**, co miesiąc:" },
  { from: "K", text: "**3 płatności**," },
  { from: "L", text: "wpływ **min. 1000 zł** z innego banku" },
  { from: "M", text: "i **logowanie** do apki." },
  { from: "N", text: "Otwierasz konto z kartą **online**," },
  { from: "O", text: "wpisujesz kod **PREMIA2026**" },
  { from: "P", text: "i dajesz wymagane **zgody**." },
  { from: "Q", text: "Oferta dla **nowych klientów**," },
  { from: "R", text: "tylko do **13 października**." },
  { from: "S", text: "Pełne zasady i koszty:" },
  { from: "T", text: "**bankmiplaci.pl**" },
  { from: "U", text: "Link w bio." },
];

/** okna czasowe napisów w klatkach; napis trwa do początku następnego (maks. +0,6 s po końcu frazy) */
export const CAPTION_WINDOWS = CAPTIONS.map((c, i) => {
  const from = at(c.from) - 2;
  const ownEnd = endOf(c.to ?? c.from) + Math.round(0.6 * FPS);
  const next = CAPTIONS[i + 1] ? at(CAPTIONS[i + 1].from) - 2 : DURATION;
  return { ...c, start: from, end: Math.min(ownEnd, next) };
});

// Efekty dźwiękowe — tylko tam, gdzie wspierają to, co właśnie mówi lektor.
export type SfxKind = "amount" | "whoosh" | "beep" | "click" | "tick" | "pop" | "soft";
export type Sfx = { f: number; kind: SfxKind; gain?: number };

export const SFX: Sfx[] = [
  { f: 0, kind: "amount", gain: 1 }, // sprężyste wejście DO 800 ZŁ
  { f: WORD.obraczka - 6, kind: "whoosh", gain: 0.55 }, // obrączka wjeżdża
  { f: WORD.zakupy + 4, kind: "beep", gain: 0.9 }, // jedno "pik" terminala
  { f: SCENES.payout.from, kind: "whoosh", gain: 0.45 },
  { f: at("E"), kind: "tick", gain: 0.6 },
  { f: at("F"), kind: "tick", gain: 0.6 },
  { f: at("G"), kind: "tick", gain: 0.6 },
  { f: endOf("G") - 6, kind: "pop", gain: 0.7 }, // licznik domyka się na DO 800 ZŁ
  { f: SCENES.conditions.from, kind: "whoosh", gain: 0.4 },
  { f: at("K") - 2, kind: "click", gain: 0.8 },
  { f: at("L") - 2, kind: "click", gain: 0.8 },
  { f: at("M") - 2, kind: "click", gain: 0.8 },
  { f: SCENES.form.from, kind: "whoosh", gain: 0.4 },
  ...Array.from({ length: 10 }, (_, k) => ({
    f: Math.round(WORD.premia + ((WORD.kodKoniec - WORD.premia) * k) / 10),
    kind: "tick" as SfxKind,
    gain: 0.22,
  })), // pisanie PREMIA2026
  { f: WORD.zgody, kind: "click", gain: 0.6 },
  { f: SCENES.eligibility.from, kind: "soft", gain: 0.5 },
  { f: SCENES.end.from, kind: "whoosh", gain: 0.5 },
  { f: at("T"), kind: "pop", gain: 0.55 },
];
