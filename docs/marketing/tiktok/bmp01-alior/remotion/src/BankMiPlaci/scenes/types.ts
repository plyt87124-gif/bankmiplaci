import type { Promo } from "../promo";

/** t = klatka liczona od początku sceny, dur = nominalna długość sceny (bez nakładki przejścia) */
export type SceneProps = { t: number; dur: number; p: Promo };
