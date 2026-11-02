import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { Easing, interpolate, spring } from "remotion";

// Ta sama typografia co bankmiplaci.pl: Fraunces (nagłówki/logo), Inter (tekst), IBM Plex Mono (kody, kwoty w tabelach).
export const { fontFamily: sans } = loadInter("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin", "latin-ext"],
});
export const { fontFamily: serif } = loadFraunces("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});
export const { fontFamily: mono } = loadMono("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

// Kolory marki = tokeny z bank-promo-comparator/src/app/globals.css (motyw jasny).
export const B = {
  paper: "#F6F7F5",
  surface: "#FFFFFF",
  ink: "#0E1B2A",
  ink700: "#243447",
  ink500: "#516176",
  ink300: "#8B98A8",
  ink100: "#E4E8EC",
  teal700: "#0B5E52",
  teal600: "#0F7B6C",
  teal500: "#159683",
  teal100: "#DCEFEA",
  gold600: "#A9822A",
  gold100: "#F4EAD2",
  coral600: "#C24C3A",
  coral100: "#F7E2DD",
};

export const W = 1080;
export const H = 1920;
export const FPS = 30;

// Strefy bezpieczne TikToka (brief): 220 px wolnego na dole, ~160 px po prawej, reszta min. 90 px od krawędzi.
export const SAFE = { left: 90, right: W - 160, top: 90, bottom: H - 220 };
// Środek strefy bezpiecznej w poziomie — wszystko, co wyśrodkowane, centrujemy tutaj, nie na W/2.
export const CX = (SAFE.left + SAFE.right) / 2; // 505
export const SAFE_W = SAFE.right - SAFE.left; // 830

// Pionowy podział kadru: scena u góry, pas napisów lektorskich nad interfejsem TikToka.
export const LAYOUT = {
  contentTop: 110,
  contentBottom: 1420,
  captionTop: 1450,
  captionBottom: SAFE.bottom - 10, // 1690
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ease = (
  frame: number,
  input: [number, number],
  output: [number, number] = [0, 1],
  easing: (t: number) => number = Easing.bezier(0.22, 1, 0.36, 1),
) => interpolate(frame, input, output, { ...clamp, easing });

export const easeInOut = (frame: number, input: [number, number], output: [number, number] = [0, 1]) =>
  interpolate(frame, input, output, { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Sprężyste wejście (lekki overshoot) — dla kwot i kart.
export const pop = (frame: number, fps = FPS, damping = 11, stiffness = 170) =>
  spring({ frame, fps, config: { damping, stiffness, mass: 0.7 } });

export const cardShadow = "0 2px 0 rgba(14,27,42,0.04), 0 18px 40px -18px rgba(14,27,42,0.28)";
