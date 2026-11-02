import { AbsoluteFill } from "remotion";
import { B, H, W } from "./theme";

// Jasne tło jak w referencji, ale żywe: dwie miękkie plamy koloru marki dryfują powoli,
// delikatna siatka kropek daje głębię przy ruchach kamery.
export const Background: React.FC<{ f: number; pulse?: number }> = ({ f, pulse = 0 }) => {
  const t = f / 30;
  const ax = 260 + Math.sin(t * 0.35) * 120;
  const ay = 420 + Math.cos(t * 0.27) * 140;
  const bx = 820 + Math.cos(t * 0.31) * 110;
  const by = 1380 + Math.sin(t * 0.23) * 160;
  return (
    <AbsoluteFill style={{ backgroundColor: B.paper, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(900px 900px at ${ax}px ${ay}px, rgba(21,150,131,${0.13 + pulse * 0.08}), transparent 70%)`,
            `radial-gradient(800px 800px at ${bx}px ${by}px, rgba(169,130,42,0.09), transparent 70%)`,
            `radial-gradient(1400px 1000px at 50% 45%, #FFFFFF, transparent 75%)`,
          ].join(","),
        }}
      />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <defs>
          <pattern id="bmp-dots" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${(-f * 0.4) % 36})`}>
            <circle cx="18" cy="18" r="1.6" fill="rgba(14,27,42,0.10)" />
          </pattern>
          <radialGradient id="bmp-fade" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#fff" stopOpacity="1" />
          </radialGradient>
          <mask id="bmp-mask">
            <rect width={W} height={H} fill="#fff" />
            <rect width={W} height={H} fill="url(#bmp-fade)" />
          </mask>
        </defs>
        <rect width={W} height={H} fill="url(#bmp-dots)" mask="url(#bmp-mask)" />
      </svg>
    </AbsoluteFill>
  );
};

/** ukośny błysk światła przelatujący przez kadr przy zmianie sceny (p: 0..1) */
export const LightSweep: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0 || p >= 1) return null;
  const x = -600 + p * (W + 1200);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "soft-light" }}>
      <div
        style={{
          position: "absolute",
          top: -400,
          left: x,
          width: 420,
          height: H + 800,
          transform: "rotate(18deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)",
          filter: "blur(30px)",
        }}
      />
    </AbsoluteFill>
  );
};
