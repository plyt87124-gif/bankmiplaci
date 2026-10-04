// Plik napisów SRT z tych samych okien czasowych, które film wypala w obrazie (timeline.ts → CAPTION_WINDOWS).
// Uruchom: node scripts/make-bmp01-srt.ts [ścieżka wyjściowa]  (domyślnie out/bmp01-alior/bmp01-alior.srt)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CAPTION_WINDOWS, FPS } from "../src/BankMiPlaci/timeline.ts";

const out = process.argv[2] ?? "out/bmp01-alior/bmp01-alior.srt";

const ts = (frame: number) => {
  const ms = Math.round((frame / FPS) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};

const srt = CAPTION_WINDOWS.map(
  (c, i) => `${i + 1}\n${ts(Math.max(0, c.start))} --> ${ts(c.end)}\n${c.text.replace(/\*\*/g, "")}\n`,
).join("\n");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, srt, "utf8");
console.log(`SRT: ${out} (${CAPTION_WINDOWS.length} napisów)`);
