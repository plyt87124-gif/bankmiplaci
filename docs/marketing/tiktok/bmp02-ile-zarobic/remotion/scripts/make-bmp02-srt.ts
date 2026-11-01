// Plik SRT z tych samych okien co napisy w obrazie (src/BMP02/timeline.ts → CAPTION_WINDOWS).
// Uruchom: node scripts/make-bmp02-srt.ts [ścieżka]  (domyślnie out/bmp02/bmp02-ile-zarobic.srt)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CAPTION_WINDOWS, FPS } from "../src/BMP02/timeline.ts";

const out = process.argv[2] ?? "out/bmp02/bmp02-ile-zarobic.srt";
const ts = (frame: number) => {
  const ms = Math.round((Math.max(0, frame) / FPS) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`;
};
const srt = CAPTION_WINDOWS.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text.replace(/\*\*/g, "")}\n`).join("\n");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, srt, "utf8");
console.log(`SRT: ${out} (${CAPTION_WINDOWS.length} napisów)`);
