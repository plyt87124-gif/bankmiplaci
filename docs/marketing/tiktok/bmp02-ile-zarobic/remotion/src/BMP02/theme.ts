import { loadFont as loadExo2 } from "@remotion/google-fonts/Exo2";
import { loadFont as loadLexend } from "@remotion/google-fonts/Lexend";
import { Easing, interpolate, spring } from "remotion";

// Ta sama typografia co bankmiplaci.pl po redesignie v2: Exo 2 (kwoty, nagłówki, przyciski, etykiety), Lexend (tekst).
export const { fontFamily: brand } = loadExo2("normal", { weights: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: body } = loadLexend("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });

// Kolory = tokeny ciemnego motywu strony (src/app/globals.css, .dark) — domyślny motyw serwisu.
export const C = {
  paper: "#0B1420",
  surface: "#15202E",
  sunken: "#08101A",
  ink: "#F2F4F6",
  ink700: "#C7CFD8",
  ink500: "#93A0AF",
  ink300: "#5A6B7D",
  ink100: "#263244",
  line: "#283648",
  lineStrong: "#697A8E",
  action: "#78B2FF",
  onAction: "#05122C",
  brandSoft: "#46A0FF",
  gold: "#E6BE64",
  gold100: "#362C16",
  coral: "#F0806E",
  coral100: "#3A1E1A",
  success: "#6EC896",
  success100: "#183224",
  ember: "#FFA35C",
};

export const W = 1080;
export const H = 1920;
export const SAFE = { left: 90, right: W - 160, top: 90, bottom: H - 220 };
export const CX = (SAFE.left + SAFE.right) / 2; // 505
export const SAFE_W = SAFE.right - SAFE.left; // 830
export const LAYOUT = { captionTop: 1450, captionBottom: SAFE.bottom - 10 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = (f: number, i: [number, number], o: [number, number] = [0, 1]) =>
  interpolate(f, i, o, { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
export const easeInOut = (f: number, i: [number, number], o: [number, number] = [0, 1]) =>
  interpolate(f, i, o, { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const pop = (f: number, damping = 12, stiffness = 170) =>
  spring({ frame: f, fps: 30, config: { damping, stiffness, mass: 0.7 } });

/** „2 900” — grupowanie także dla liczb 4-cyfrowych (Intl pl-PL grupuje dopiero od 5 cyfr); twarda spacja */
export const zl = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
