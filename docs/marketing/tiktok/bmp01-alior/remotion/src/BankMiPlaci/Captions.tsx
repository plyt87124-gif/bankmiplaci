import { AbsoluteFill } from "remotion";
import { CAPTION_WINDOWS } from "./timeline";
import { B, CX, ease, LAYOUT, sans } from "./theme";
import { Rich } from "./ui";

// Napisy lektorskie wypalone w obrazie: maks. 2 linie, w pasie nad interfejsem TikToka
// (dół kadru 220 px wolny), wyśrodkowane w strefie bezpiecznej (prawe 160 px wolne).
export const Captions: React.FC<{ f: number }> = ({ f }) => {
  const c = CAPTION_WINDOWS.find((w) => f >= w.start && f < w.end);
  if (!c) return null;
  const t = f - c.start;
  const out = c.end - f;
  const inP = ease(t, [0, 6]);
  const outP = ease(out, [0, 4]);
  const maxW = 780;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: CX - maxW / 2,
          width: maxW,
          bottom: 1920 - LAYOUT.captionBottom,
          height: LAYOUT.captionBottom - LAYOUT.captionTop,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 54,
            lineHeight: 1.18,
            color: B.ink,
            textAlign: "center",
            background: "rgba(255,255,255,0.92)",
            border: `2px solid ${B.ink100}`,
            borderRadius: 28,
            padding: "16px 30px 18px",
            boxShadow: "0 16px 40px -20px rgba(14,27,42,0.35)",
            maxWidth: maxW,
            opacity: Math.min(inP, outP),
            transform: `translateY(${(1 - inP) * 18}px) scale(${0.96 + 0.04 * inP})`,
            // maks. 2 linie
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          <Rich text={c.text} hl={B.teal600} hlWeight={900} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
