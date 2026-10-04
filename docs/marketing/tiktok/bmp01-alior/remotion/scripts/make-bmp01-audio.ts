// Ścieżka dźwiękowa filmu BankMiPłaci TikTok 01 (Alior) — wszystko poza lektorem jest syntezowane
// od zera (zero sampli z zewnątrz = zero kłopotów licencyjnych).
// Uruchom: node scripts/make-bmp01-audio.ts
//   wejście:  public/bmp01/voice_src.wav  (surowy lektor HeyGen, PCM16 mono 44,1 kHz)
//   wyjście:  public/bmp01/voice.wav      (zmontowany lektor, mono)
//             public/bmp01/music_sfx.wav  (muzyka + efekty, bez lektora — do przyszłych zmian)
//             public/bmp01/mix.wav        (miks końcowy, stereo PCM16, ok. −14 LUFS, true peak ≤ −1 dBTP)
// Czasy (frazy, sceny, efekty) pochodzą z src/BankMiPlaci/timeline.ts — tego samego pliku co obraz.
import { readFileSync, writeFileSync } from "node:fs";
import { DURATION, FPS, SCENES, SFX, VOICE, VOICE_PAD, type SfxKind } from "../src/BankMiPlaci/timeline.ts";

const SR = 44100;
const N = Math.ceil((DURATION / FPS) * SR);
const idx = (sec: number) => Math.round(sec * SR);
const fsec = (frame: number) => frame / FPS;
const db = (x: number) => 20 * Math.log10(Math.max(1e-12, x));
const fromDb = (d: number) => Math.pow(10, d / 20);
const DIR = "public/bmp01";

// deterministyczny generator szumu (bez Math.random — powtarzalny wynik)
let seed = 0x2f6b1d;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};

// ---------- WAV ----------
const readWav = (path: string): { sr: number; data: Float32Array } => {
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error(`${path}: to nie jest WAV`);
  let off = 12;
  let fmt = { format: 1, ch: 1, sr: SR, bits: 16 };
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      fmt = { format: b.readUInt16LE(body), ch: b.readUInt16LE(body + 2), sr: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    } else if (id === "data") {
      const bytes = fmt.bits / 8;
      const frames = Math.floor(size / (bytes * fmt.ch));
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.ch; c++) {
          const p = body + (i * fmt.ch + c) * bytes;
          if (fmt.format === 3 && fmt.bits === 32) s += b.readFloatLE(p);
          else if (fmt.bits === 16) s += b.readInt16LE(p) / 32768;
          else if (fmt.bits === 24) s += (b.readIntLE(p, 3) as number) / 8388608;
          else if (fmt.bits === 32) s += b.readInt32LE(p) / 2147483648;
          else throw new Error(`${path}: nieobsługiwany format ${fmt.format}/${fmt.bits} bit`);
        }
        out[i] = s / fmt.ch;
      }
      return { sr: fmt.sr, data: out };
    }
    off = body + size + (size % 2);
  }
  throw new Error(`${path}: brak danych audio`);
};

const writeWav = (path: string, chans: Float32Array[]) => {
  const ch = chans.length;
  const n = chans[0].length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * ch * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * ch * 2, 28);
  buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const dither = (noise() + noise()) * 0.5 / 32768; // TPDF
      const v = Math.max(-1, Math.min(1, chans[c][i] + dither));
      buf.writeInt16LE(Math.round(v * 32767), 44 + (i * ch + c) * 2);
    }
  writeFileSync(path, buf);
};

const rmsOf = (x: Float32Array, a: number, b: number) => {
  let s = 0;
  const i0 = Math.max(0, a);
  const i1 = Math.min(x.length, b);
  for (let i = i0; i < i1; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, i1 - i0));
};

// ---------- 1) montaż lektora ----------
const src = readWav(`${DIR}/voice_src.wav`);
if (src.sr !== SR) throw new Error(`voice_src.wav ma ${src.sr} Hz, oczekuję ${SR} Hz (ffmpeg -i voice_raw.wav -ac 1 -ar 44100 -c:a pcm_s16le voice_src.wav)`);
const voice = new Float32Array(N);
const FADE = idx(0.008);
const warnings: string[] = [];
for (const s of VOICE) {
  const a = idx(s.src[0] - VOICE_PAD.pre);
  const b = idx(s.src[1] + VOICE_PAD.post);
  const o = idx(s.out[0] - VOICE_PAD.pre);
  for (const [edge, label] of [
    [a, "początek"],
    [b, "koniec"],
  ] as const) {
    const level = db(rmsOf(src.data, edge - idx(0.005), edge + idx(0.005)));
    if (level > -38) warnings.push(`fraza ${s.id} (${label}, ${(edge / SR).toFixed(3)} s): ${level.toFixed(1)} dBFS — cięcie nie w ciszy`);
  }
  const len = b - a;
  for (let i = 0; i < len; i++) {
    const j = o + i;
    if (j < 0 || j >= N || a + i < 0 || a + i >= src.data.length) continue;
    const g = Math.min(1, i / FADE, (len - 1 - i) / FADE);
    voice[j] += src.data[a + i] * g;
  }
}

// obwiednia lektora (do duckingu muzyki): atak 25 ms, zwolnienie 250 ms
const voiceEnv = new Float32Array(N);
{
  const att = 1 - Math.exp(-1 / (0.025 * SR));
  const rel = 1 - Math.exp(-1 / (0.25 * SR));
  let e = 0;
  for (let i = 0; i < N; i++) {
    const x = Math.abs(voice[i]);
    e += (x - e) * (x > e ? att : rel);
    voiceEnv[i] = e;
  }
}

// ---------- 2) muzyka (własna kompozycja, F-dur, 108 BPM) ----------
const BPM = 108;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// I–V–vi–IV: F, C, Dm, B♭ (dźwięki akordów w MIDI)
const CHORDS = {
  F: [53, 57, 60],
  C: [48, 52, 55],
  Dm: [50, 53, 57],
  Bb: [46, 50, 53],
} as const;
type ChordName = keyof typeof CHORDS;
const PROG: ChordName[] = ["F", "C", "Dm", "Bb"];
const endSec = DURATION / FPS;
const lastBars = Math.floor(endSec / BAR);
// ostatnie dwa takty: C → F (rozwiązanie na końcowej planszy)
const chordAt = (bar: number): ChordName => (bar >= lastBars ? "F" : bar === lastBars - 1 ? "C" : PROG[bar % 4]);

// natężenie aranżacji w scenach (0..1): oszczędnie w hooku, pełniej w środku, spokojniej przed CTA
const sceneOf = (sec: number) => {
  const f = sec * FPS;
  if (f < SCENES.payout.from) return "hook";
  if (f < SCENES.conditions.from) return "payout";
  if (f < SCENES.form.from) return "conditions";
  if (f < SCENES.eligibility.from) return "form";
  if (f < SCENES.end.from) return "eligibility";
  return "end";
};
const LAYERS: Record<string, { kick: number; hat: number; pluck: number; pad: number }> = {
  hook: { kick: 0, hat: 0, pluck: 0.7, pad: 0.8 },
  payout: { kick: 0.8, hat: 0.6, pluck: 1, pad: 0.9 },
  conditions: { kick: 0.9, hat: 0.8, pluck: 1, pad: 1 },
  form: { kick: 0.9, hat: 0.8, pluck: 1, pad: 1 },
  eligibility: { kick: 0, hat: 0.3, pluck: 0.6, pad: 0.9 },
  end: { kick: 0.5, hat: 0, pluck: 0.8, pad: 1 },
};
// płynne przejścia warstw (200 ms) zamiast skoków na granicach scen
const layer = (sec: number, key: "kick" | "hat" | "pluck" | "pad") => {
  const a = LAYERS[sceneOf(sec - 0.1)][key];
  const b = LAYERS[sceneOf(sec + 0.1)][key];
  return (a + b) / 2;
};

const musL = new Float32Array(N);
const musR = new Float32Array(N);
const add = (buf: Float32Array, i: number, v: number) => {
  if (i >= 0 && i < N) buf[i] += v;
};

// pad: miękkie, rozstrojone fale (5 harmonicznych), przenikanie akordów, filtr dolnoprzepustowy
{
  let lpL = 0;
  let lpR = 0;
  const cut = 1 - Math.exp((-2 * Math.PI * 1400) / SR);
  const phases = new Float64Array(64);
  for (let i = 0; i < N; i++) {
    const sec = i / SR;
    const bar = Math.floor(sec / BAR);
    const inBar = sec - bar * BAR;
    const xf = Math.min(1, inBar / 0.18); // przenikanie z poprzedniego akordu
    let l = 0;
    let r = 0;
    for (const [k, w] of [
      [bar, xf],
      [bar - 1, 1 - xf],
    ] as const) {
      if (w <= 0 || k < 0) continue;
      CHORDS[chordAt(k)].forEach((m, v) => {
        for (const side of [0, 1] as const) {
          const ph = phases[v * 2 + side];
          let s = 0;
          for (let h = 1; h <= 5; h++) s += Math.sin(ph * h) / h;
          if (side === 0) l += s * w;
          else r += s * w;
        }
      });
    }
    // fazy aktualnego akordu (wspólne dla przenikania — różnica niesłyszalna przy tym tempie)
    CHORDS[chordAt(bar)].forEach((m, v) => {
      phases[v * 2] += (2 * Math.PI * midiHz(m + 12 - 0.07)) / SR;
      phases[v * 2 + 1] += (2 * Math.PI * midiHz(m + 12 + 0.07)) / SR;
    });
    lpL += (l - lpL) * cut;
    lpR += (r - lpR) * cut;
    const swell = 0.85 + 0.15 * Math.sin((2 * Math.PI * sec) / (BAR * 2));
    const g = 0.035 * layer(sec, "pad") * swell;
    musL[i] += lpL * g;
    musR[i] += lpR * g;
  }
}

// arpeggio: struna Karplusa-Stronga, ósemki, delikatnie na przemian L/P
{
  const PATTERN = [0, 1, 2, 1, 3, 2, 1, 2];
  const steps = Math.floor(endSec / (BEAT / 2));
  for (let s = 0; s < steps; s++) {
    const t0 = s * (BEAT / 2);
    const lvl = layer(t0, "pluck");
    if (lvl <= 0) continue;
    if (sceneOf(t0) === "hook" && s % 2 === 1) continue; // w hooku rzadziej
    const bar = Math.floor(t0 / BAR);
    const ch = CHORDS[chordAt(bar)];
    const tones = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24];
    const m = tones[PATTERN[s % 8]];
    const f = midiHz(m);
    const period = Math.max(2, Math.round(SR / f));
    const ring = new Float32Array(period);
    for (let k = 0; k < period; k++) ring[k] = noise() * 0.5;
    const len = idx(1.1);
    const accent = s % 4 === 0 ? 1 : 0.72;
    const pan = s % 2 === 0 ? 0.35 : -0.35;
    let prev = 0;
    for (let k = 0; k < len; k++) {
      const p = k % period;
      const cur = ring[p];
      ring[p] = 0.996 * 0.5 * (cur + prev);
      prev = cur;
      const env = Math.min(1, k / 40);
      const v = cur * env * 0.16 * lvl * accent;
      add(musL, idx(t0) + k, v * (1 - pan));
      add(musR, idx(t0) + k, v * (1 + pan));
    }
  }
}

// stopa + sub na 1 i 3 miarę, hi-hat na "i" (ósemki nieparzyste)
{
  const beats = Math.floor(endSec / BEAT);
  for (let b = 0; b < beats; b++) {
    const t0 = b * BEAT;
    const k = layer(t0, "kick");
    if (k > 0 && b % 2 === 0) {
      const root = midiHz(CHORDS[chordAt(Math.floor(t0 / BAR))][0] - 12);
      let ph = 0;
      for (let i = 0; i < idx(0.35); i++) {
        const tt = i / SR;
        const f = 48 + 70 * Math.exp(-tt / 0.03);
        ph += (2 * Math.PI * f) / SR;
        const kick = Math.sin(ph) * Math.exp(-tt / 0.16) * 0.42;
        const sub = Math.sin(2 * Math.PI * root * tt) * Math.exp(-tt / 0.22) * 0.1 * Math.min(1, tt / 0.01);
        const v = (kick + sub) * k;
        add(musL, idx(t0) + i, v);
        add(musR, idx(t0) + i, v);
      }
    }
    const h = layer(t0 + BEAT / 2, "hat");
    if (h > 0) {
      let x1 = 0;
      let x2 = 0;
      for (let i = 0; i < idx(0.05); i++) {
        const x = noise();
        const hp = x - 2 * x1 + x2; // prosty górnoprzepustowy (2. różnica)
        x2 = x1;
        x1 = x;
        const v = hp * Math.exp(-i / SR / 0.012) * 0.025 * h;
        add(musL, idx(t0 + BEAT / 2) + i, v * 0.8);
        add(musR, idx(t0 + BEAT / 2) + i, v * 1.2);
      }
    }
  }
}

// wyciszenie muzyki na ostatniej sekundzie
for (let i = Math.max(0, N - idx(1.0)); i < N; i++) {
  const g = (N - i) / idx(1.0);
  musL[i] *= g * g;
  musR[i] *= g * g;
}

// ---------- 3) efekty dźwiękowe ----------
const sfx = new Float32Array(N);
// filtr pasmowy SVF o zmiennej częstotliwości (do szumów typu "whoosh")
const sweepNoise = (start: number, dur: number, f0: number, f1: number, amp: number, shape: (k: number) => number) => {
  let low = 0;
  let band = 0;
  const n = idx(dur);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const f = f0 * Math.pow(f1 / f0, k);
    const F = 2 * Math.sin((Math.PI * Math.min(f, SR / 6)) / SR);
    const q = 0.5;
    const x = noise();
    const high = x - low - q * band;
    band += F * high;
    low += F * band;
    add(sfx, start + i, band * amp * shape(k));
  }
};
const tone = (start: number, dur: number, freq: (tt: number) => number, amp: (tt: number) => number) => {
  let ph = 0;
  for (let i = 0; i < idx(dur); i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * freq(tt)) / SR;
    add(sfx, start + i, Math.sin(ph) * amp(tt));
  }
};
const SYNTH: Record<SfxKind, (at: number, g: number) => void> = {
  amount: (at, g) => {
    tone(at, 0.35, (tt) => 55 + 60 * Math.exp(-tt / 0.04), (tt) => 0.5 * g * Math.exp(-tt / 0.12) * Math.min(1, tt / 0.004));
    sweepNoise(at, 0.22, 3000, 600, 0.35 * g, (k) => Math.pow(1 - k, 2));
    for (const [f, d] of [
      [2637, 0.02],
      [3951, 0.06],
      [5274, 0.1],
    ] as const)
      tone(at + idx(d), 0.5, () => f, (tt) => 0.05 * g * Math.exp(-tt / 0.14) * Math.min(1, tt / 0.003));
  },
  whoosh: (at, g) => sweepNoise(at - idx(0.12), 0.32, 450, 2600, 0.55 * g, (k) => Math.sin(Math.PI * k) ** 2),
  beep: (at, g) =>
    tone(at, 0.15, () => 2800, (tt) => 0.22 * g * Math.min(1, tt / 0.005, (0.15 - tt) / 0.02)),
  click: (at, g) => {
    sweepNoise(at, 0.012, 2500, 2500, 0.6 * g, (k) => 1 - k);
    tone(at, 0.02, () => 1700, (tt) => 0.12 * g * Math.exp(-tt / 0.005));
  },
  tick: (at, g) => sweepNoise(at, 0.006, 4500, 4500, 0.5 * g, (k) => 1 - k),
  pop: (at, g) => tone(at, 0.09, (tt) => 300 + 600 * Math.exp(-tt / 0.02), (tt) => 0.3 * g * Math.exp(-tt / 0.03) * Math.min(1, tt / 0.002)),
  soft: (at, g) => {
    for (const f of [110, 164.8, 220])
      tone(at, 1.0, () => f, (tt) => 0.09 * g * Math.min(1, tt / 0.3) * Math.exp(-Math.max(0, tt - 0.3) / 0.35));
  },
};
for (const s of SFX) SYNTH[s.kind](idx(fsec(s.f)), s.gain ?? 1);

// ---------- 4) poziomy, ducking, miks ----------
const speech = VOICE.map((s) => [idx(s.out[0]), idx(s.out[1])] as const);
const speechRms = (x: Float32Array, from = 0, to = N) => {
  let sum = 0;
  let n = 0;
  for (const [a, b] of speech)
    for (let i = Math.max(a, from); i < Math.min(b, to); i++) {
      sum += x[i] * x[i];
      n++;
    }
  return Math.sqrt(sum / Math.max(1, n));
};
const vPeak = voice.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const vRms = speechRms(voice);
const duckMax = 1 - fromDb(-9);
const duck = new Float32Array(N);
for (let i = 0; i < N; i++) duck[i] = 1 - duckMax * Math.min(1, voiceEnv[i] / (vRms * 0.6));
const musMono = new Float32Array(N);
for (let i = 0; i < N; i++) musMono[i] = ((musL[i] + musR[i]) / 2) * duck[i];
// muzyka (po duckingu) ma być w czasie mowy ok. 19 dB pod lektorem
const musGain = (vRms * fromDb(-19)) / Math.max(1e-9, speechRms(musMono));
// korekta per scena: w każdej scenie muzyka ok. 19 dB pod lektorem (gęstsza aranżacja = ciszej),
// w scenach z rzadką aranżacją podbicie maks. +4 dB; przejścia między scenami 0,3 s
const MUSIC_UNDER_VOICE = 19;
const sceneAdj = Object.values(SCENES).map((s) => {
  const a = idx(fsec(s.from));
  const b = idx(fsec(s.to));
  const v = speechRms(voice, a, b);
  const m = speechRms(musMono, a, b) * musGain;
  if (v <= 0 || m <= 0) return 0;
  return Math.max(-6, Math.min(4, db(v) - db(m) - MUSIC_UNDER_VOICE));
});
const sceneGain = new Float32Array(N);
{
  const bounds = Object.values(SCENES).map((s) => idx(fsec(s.from)));
  const XF = idx(0.3);
  for (let i = 0; i < N; i++) {
    let k = 0;
    while (k + 1 < bounds.length && i >= bounds[k + 1]) k++;
    let d = sceneAdj[k];
    if (k + 1 < bounds.length && i > bounds[k + 1] - XF) {
      const w = (i - (bounds[k + 1] - XF)) / XF;
      d = d * (1 - w) + sceneAdj[k + 1] * w;
    }
    sceneGain[i] = fromDb(d);
  }
  for (let i = 0; i < N; i++) duck[i] *= sceneGain[i];
}
const sfxPeak = sfx.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const sfxGain = (vPeak * fromDb(-5)) / Math.max(1e-9, sfxPeak); // najgłośniejszy efekt ~5 dB pod szczytem lektora

const mixL = new Float32Array(N);
const mixR = new Float32Array(N);
const bedL = new Float32Array(N);
const bedR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const s = sfx[i] * sfxGain;
  bedL[i] = musL[i] * duck[i] * musGain + s;
  bedR[i] = musR[i] * duck[i] * musGain + s;
  mixL[i] = voice[i] + bedL[i];
  mixR[i] = voice[i] + bedR[i];
}

// ---------- 5) głośność: ITU-R BS.1770 (K-ważenie, bramkowanie) + true peak (4× nadpróbkowanie) ----------
const biquad = (x: Float32Array, b: number[], a: number[]) => {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
};
const kWeight = (x: Float32Array) => {
  let K = Math.tan((Math.PI * 1681.974450955533) / SR);
  const Vh = Math.pow(10, 3.999843853973347 / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const s1 = biquad(
    x,
    [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  );
  K = Math.tan((Math.PI * 38.13547087602444) / SR);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  return biquad(s1, [1, -2, 1], [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]);
};
const lufs = (L: Float32Array, R: Float32Array) => {
  const kl = kWeight(L);
  const kr = kWeight(R);
  const block = idx(0.4);
  const step = idx(0.1);
  const z: number[] = [];
  for (let s = 0; s + block <= kl.length; s += step) {
    let e = 0;
    for (let i = s; i < s + block; i++) e += kl[i] * kl[i] + kr[i] * kr[i];
    z.push(e / block);
  }
  const loud = (e: number) => -0.691 + 10 * Math.log10(Math.max(1e-12, e));
  const abs = z.filter((e) => loud(e) > -70);
  const rel = loud(abs.reduce((a, b) => a + b, 0) / Math.max(1, abs.length)) - 10;
  const gated = abs.filter((e) => loud(e) > rel);
  return loud(gated.reduce((a, b) => a + b, 0) / Math.max(1, gated.length));
};
// interpolator 4× (okienkowany sinc, 32 współczynniki na fazę) → szczyty między próbkami
const OS = 4;
const TAPS = 32;
const PHASES = Array.from({ length: OS }, (_, p) =>
  Array.from({ length: TAPS }, (_, k) => {
    const x = k - TAPS / 2 + 1 - p / OS;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / (TAPS / 2));
    return sinc * w;
  }),
);
const truePeakEnv = (x: Float32Array) => {
  const env = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let m = Math.abs(x[i]);
    for (let p = 1; p < OS; p++) {
      let v = 0;
      const c = PHASES[p];
      for (let k = 0; k < TAPS; k++) {
        const j = i + k - TAPS / 2 + 1;
        if (j >= 0 && j < x.length) v += x[j] * c[k];
      }
      m = Math.max(m, Math.abs(v));
    }
    env[i] = m;
  }
  return env;
};

const TARGET_LUFS = -14;
const CEIL = fromDb(-1.3); // zapas pod −1 dBTP
const preLufs = lufs(mixL, mixR);
const norm = fromDb(TARGET_LUFS - preLufs);
for (let i = 0; i < N; i++) {
  mixL[i] *= norm;
  mixR[i] *= norm;
}
// limiter z wyprzedzeniem (3 ms): wzmocnienie opada płynnie PRZED szczytem, wraca w ~80 ms
{
  const eL = truePeakEnv(mixL);
  const eR = truePeakEnv(mixR);
  const W = idx(0.003);
  const req = new Float32Array(N);
  for (let i = 0; i < N; i++) req[i] = Math.min(1, CEIL / Math.max(1e-9, eL[i], eR[i]));
  const minAhead = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let m = 1;
    for (let k = i; k <= Math.min(N - 1, i + W); k++) if (req[k] < m) m = req[k];
    minAhead[i] = m;
  }
  const rel = 1 - Math.exp(-1 / (0.08 * SR));
  let acc = W + 1; // suma okna [i−W, i]; przed początkiem pliku wzmocnienie = 1
  let g = 1;
  for (let i = 0; i < N; i++) {
    acc += minAhead[i] - (i - W - 1 >= 0 ? minAhead[i - W - 1] : 1);
    const smooth = acc / (W + 1);
    const target = Math.min(smooth, minAhead[i]);
    g = target < g ? target : g + (target - g) * rel;
    mixL[i] *= g;
    mixR[i] *= g;
  }
}

writeWav(`${DIR}/voice.wav`, [voice]);
writeWav(`${DIR}/music_sfx.wav`, [bedL.map((v) => v * norm), bedR.map((v) => v * norm)]);
writeWav(`${DIR}/mix.wav`, [mixL, mixR]);

// ---------- 6) raport ----------
const finalLufs = lufs(mixL, mixR);
const peakOf = (x: Float32Array) => x.reduce((m, v) => Math.max(m, v), 0);
const tp = Math.max(peakOf(truePeakEnv(mixL)), peakOf(truePeakEnv(mixR)));
console.log(`Długość: ${(N / SR).toFixed(2)} s (DURATION ${DURATION} kl. = ${(DURATION / FPS).toFixed(2)} s)`);
console.log(`Głośność: ${finalLufs.toFixed(1)} LUFS (cel ${TARGET_LUFS}), true peak ${db(tp).toFixed(1)} dBTP`);
console.log("Lektor vs muzyka w czasie mowy (RMS, im więcej, tym muzyka ciszej):");
const musDucked = new Float32Array(N);
for (let i = 0; i < N; i++) musDucked[i] = ((musL[i] + musR[i]) / 2) * duck[i] * musGain;
for (const [id, s] of Object.entries(SCENES)) {
  const a = idx(fsec(s.from));
  const b = idx(fsec(s.to));
  const d = db(speechRms(voice, a, b)) - db(speechRms(musDucked, a, b));
  console.log(`  ${id.padEnd(12)} ${d.toFixed(1)} dB`);
}
if (warnings.length) {
  console.log("Uwaga — cięcia lektora poza ciszą:");
  for (const w of warnings) console.log("  " + w);
} else console.log("Cięcia lektora: wszystkie w ciszy (< −38 dBFS).");
console.log(`Zapisano: ${DIR}/mix.wav, ${DIR}/voice.wav, ${DIR}/music_sfx.wav`);
