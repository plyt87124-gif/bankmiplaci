import { AbsoluteFill } from "remotion";
import { PX_PER_UNIT, RingCanvas, type RingPose } from "../Ring3D";
import { B, CX, H, W, ease, easeInOut, mix, pop, sans } from "../theme";
import { at, WORD } from "../timeline";
import { CheckIcon, ContactlessIcon, IllustrationTag, Pill } from "../ui";
import type { SceneProps } from "./types";

// Scena 1: DO 800 ZŁ od pierwszej klatki → obrączka 3D wlatuje z obrotem → zbliżenie do terminala
// (jedno "pik") → pieczątka SPRAWDŹMY. Wszystkie momenty liczone z nagrania lektora (timeline.ts).

const lerpPose = (a: RingPose, b: RingPose, k: number): RingPose => ({
  x: mix(a.x, b.x, k),
  y: mix(a.y, b.y, k),
  z: mix(a.z, b.z, k),
  rotX: mix(a.rotX, b.rotX, k),
  rotY: mix(a.rotY, b.rotY, k),
  rotZ: mix(a.rotZ, b.rotZ, k),
  scale: mix(a.scale, b.scale, k),
});

// pozycja w pikselach kadru → jednostki sceny 3D (środek płótna = (540, 960), oś y w górę)
const ux = (px: number) => (px - W / 2) / PX_PER_UNIT;
const uy = (py: number) => (H / 2 - py) / PX_PER_UNIT;

// terminal (ilustracja, bez marki): lewy górny róg w docelowym położeniu
const TERM = { x: 600, y: 610, w: 290, h: 450 };
const TAP = { x: TERM.x + TERM.w / 2, y: TERM.y + 150 }; // strefa zbliżeniowa na ekranie terminala

const Terminal: React.FC<{ paid: number; nfc: number }> = ({ paid, nfc }) => (
  <div
    style={{
      position: "absolute",
      width: TERM.w,
      height: TERM.h,
      borderRadius: 46,
      background: "linear-gradient(160deg, #2A3A4D 0%, #121D2A 55%, #0B141E 100%)",
      boxShadow: "0 40px 80px -30px rgba(14,27,42,0.55), inset 0 2px 0 rgba(255,255,255,0.12)",
    }}
  >
    {/* ekran */}
    <div
      style={{
        position: "absolute",
        left: 26,
        top: 30,
        width: TERM.w - 52,
        height: 210,
        borderRadius: 24,
        background: paid > 0 ? `rgba(21,150,131,${0.25 + 0.75 * paid})` : "#0E2A30",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", opacity: 1 - paid, transform: `scale(${1 - 0.3 * paid})` }}>
        <ContactlessIcon size={120} color="#7FD3C4" progress={nfc} />
      </div>
      <div
        style={{
          position: "absolute",
          width: 120,
          height: 120,
          borderRadius: 60,
          background: "rgba(255,255,255,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: paid,
          transform: `scale(${0.6 + 0.4 * paid})`,
        }}
      >
        <CheckIcon size={92} progress={paid} stroke={8} />
      </div>
    </div>
    {/* klawiatura */}
    <div style={{ position: "absolute", left: 34, top: 268, display: "grid", gridTemplateColumns: "repeat(3, 62px)", gap: "14px 18px" }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          style={{
            height: 34,
            borderRadius: 12,
            background: i === 8 ? "rgba(21,150,131,0.55)" : "rgba(255,255,255,0.10)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
          }}
        />
      ))}
    </div>
  </div>
);

export const HookScene: React.FC<SceneProps> = ({ t, p }) => {
  // kotwice (klatki od początku sceny; scena hook zaczyna się w klatce 0)
  const fRing = WORD.obraczka - 8; // obrączka zaczyna wlatywać tuż przed słowem
  const fTermIn = WORD.zaplacisz - 6;
  const fTap = WORD.zakupy + 4; // = SFX "beep"
  const fCheck = at("C");

  // 1) kwota: czytelna od klatki 0, sprężyste osiadanie + powolny najazd kamery
  const settle = pop(t + 3, 30, 10, 190); // t=0 → już ~0.3 sprężyny, cyfry widoczne
  const push = ease(t, [0, 40], [1, 1.06]);
  const lift = easeInOut(t, [fRing - 4, fRing + 18]);
  const amountY = mix(600, 250, lift);
  const amountScale = mix(push, 0.56, lift);
  const sublineIn = ease(t, [-8, 8]); // już w klatce 0 częściowo widoczny
  const footIn = ease(t, [6, 18]);

  // 2) obrączka: wlot z obrotem → spokojne kołysanie
  const fly = ease(t, [fRing, fRing + 24]);
  const idle = Math.sin((t - fRing) * 0.06);
  const posCenter: RingPose = {
    x: ux(CX),
    y: uy(800),
    z: 0,
    rotX: Math.PI / 2 - 0.32 + 0.06 * idle,
    rotY: 0,
    rotZ: 0.42 + 0.22 * idle,
    scale: 0.6,
  };
  const posStart: RingPose = { x: ux(1060), y: uy(1500), z: -3, rotX: Math.PI / 2 - 1.1, rotY: 0, rotZ: -4 * Math.PI, scale: 0.35 };
  // przy terminalu: obrączka przesuwa się w lewo i czeka, potem "dotyka" strefy zbliżeniowej
  const posWait: RingPose = { x: ux(330), y: uy(830), z: 0, rotX: Math.PI / 2 - 0.3, rotY: 0, rotZ: 0.9 + 0.05 * idle, scale: 0.46 };
  const posTap: RingPose = { x: ux(TAP.x - 175), y: uy(TAP.y + 10), z: 0.9, rotX: Math.PI / 2 - 0.55, rotY: 0, rotZ: 1.2, scale: 0.38 };
  const posEnd: RingPose = { x: ux(CX), y: uy(660), z: 0, rotX: Math.PI / 2 - 0.28 + 0.05 * idle, rotY: 0, rotZ: 0.35 + 0.2 * idle, scale: 0.4 };

  const toWait = easeInOut(t, [fTermIn, fTermIn + 12]);
  const toTap = easeInOut(t, [fTap - 9, fTap]);
  const fromTap = easeInOut(t, [fTap + 3, fTap + 16]);
  const toEnd = easeInOut(t, [fCheck - 6, fCheck + 12]);

  let pose = lerpPose(posStart, posCenter, fly);
  pose = lerpPose(pose, posWait, toWait);
  pose = lerpPose(pose, posTap, toTap * (1 - fromTap));
  pose = lerpPose(pose, posEnd, toEnd);

  // 3) terminal + dotknięcie
  const termIn = ease(t, [fTermIn, fTermIn + 14]);
  const termOut = easeInOut(t, [fCheck - 6, fCheck + 10]);
  const termX = mix(1120, TERM.x, termIn) + termOut * 520;
  const nfc = ease(t, [fTermIn + 6, fTap - 2]);
  const paid = ease(t, [fTap, fTap + 6]);
  const glow = t < fTap ? 0.25 : 0.3 + 0.7 * Math.exp(-(t - fTap) / 6);
  const shake = t >= fTap && t < fTap + 4 ? [6, -5, 3, -1][t - fTap] : 0;
  const waves = t >= fTap ? t - fTap : -1;

  // etykiety pod obrączką
  const labIn = ease(t, [fRing + 14, fRing + 26]);
  const valIn = ease(t, [fRing + 20, fRing + 32]);
  const noteIn = ease(t, [fRing + 28, fRing + 40]);
  const tagIn = ease(t, [fRing + 22, fRing + 34]) * (1 - termOut * 0);

  // 4) SPRAWDŹMY.
  const stamp = pop(t - fCheck, 30, 9, 220);
  const stampOn = t >= fCheck;

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${-shake * 0.5}px)` }}>
      {/* DO 800 ZŁ */}
      <div
        style={{
          position: "absolute",
          left: CX - 450,
          width: 900,
          top: amountY - 200,
          height: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${amountScale})`,
          transformOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontWeight: 900,
            fontSize: 118,
            lineHeight: 1,
            color: B.teal600,
            letterSpacing: 4,
            transform: `translateY(${(1 - settle) * -40}px) scale(${mix(1.25, 1, settle)})`,
          }}
        >
          {p.hook.prefix}
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 900,
            fontSize: 232,
            lineHeight: 1,
            marginTop: 4,
            color: B.ink,
            letterSpacing: -6,
            whiteSpace: "nowrap",
            transform: `scale(${mix(1.18, 1, settle)})`,
            textShadow: "0 18px 40px rgba(14,27,42,0.12)",
          }}
        >
          {p.hook.amount}
        </div>
      </div>
      {/* podtytuł + przypis — znikają, gdy kwota odjeżdża w górę */}
      <div
        style={{
          position: "absolute",
          left: CX - 420,
          width: 840,
          top: 820,
          textAlign: "center",
          opacity: sublineIn * (1 - lift),
          transform: `translateY(${(1 - sublineIn) * 30 - lift * 120}px)`,
        }}
      >
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 54, color: B.ink, letterSpacing: 0.5 }}>{p.hook.subline}</div>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 30, color: B.ink500, marginTop: 22, opacity: footIn }}>
          {p.hook.footnote}
        </div>
      </div>

      {/* terminal (za obrączką) */}
      {t >= fTermIn && termOut < 1 && (
        <div style={{ position: "absolute", left: termX, top: TERM.y, transform: `rotate(${(1 - termIn) * 8}deg)` }}>
          <Terminal paid={paid} nfc={nfc} />
        </div>
      )}
      {/* fale NFC z punktu styku */}
      {waves >= 0 && waves < 26 && (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {[0, 5, 10].map((d) => {
            const k = Math.max(0, Math.min(1, (waves - d) / 16));
            if (k <= 0 || k >= 1) return null;
            return (
              <circle key={d} cx={TAP.x} cy={TAP.y} r={40 + k * 220} fill="none" stroke={B.teal500} strokeWidth={8 * (1 - k) + 1} opacity={(1 - k) * 0.9} />
            );
          })}
        </svg>
      )}

      {/* obrączka 3D */}
      {t >= fRing && <RingCanvas width={W} height={H} pose={pose} glow={glow} />}

      {/* znacznik ilustracji */}
      <IllustrationTag text={p.ring.illustration} style={{ left: 110, top: 470, opacity: tagIn }} />

      {/* etykiety obrączki */}
      <div style={{ position: "absolute", left: CX - 415, width: 830, top: 1120, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ opacity: labIn, transform: `translateY(${(1 - labIn) * 26}px) scale(${0.9 + 0.1 * labIn})` }}>
          <Pill tone="gold" style={{ fontSize: 44, padding: "14px 30px", letterSpacing: 1.5 }}>
            {p.ring.title}
          </Pill>
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 40,
            color: B.ink,
            marginTop: 22,
            opacity: valIn,
            transform: `translateY(${(1 - valIn) * 20}px)`,
          }}
        >
          {p.ring.value}
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 29,
            color: B.ink500,
            marginTop: 14,
            maxWidth: 700,
            textAlign: "center",
            textWrap: "balance",
            opacity: noteIn,
          }}
        >
          {p.ring.note}
        </div>
      </div>

      {/* SPRAWDŹMY. */}
      {stampOn && (
        <div
          style={{
            position: "absolute",
            left: CX - 400,
            width: 800,
            top: 905,
            display: "flex",
            justifyContent: "center",
            transform: `scale(${mix(1.6, 1, stamp)}) rotate(${mix(-12, -3, stamp)}deg)`,
            opacity: Math.min(1, stamp * 1.6),
          }}
        >
          <div
            style={{
              fontFamily: sans,
              fontWeight: 900,
              fontSize: 92,
              letterSpacing: 3,
              color: B.teal600,
              padding: "8px 34px 12px",
              border: `7px solid ${B.teal600}`,
              borderRadius: 26,
              background: "rgba(255,255,255,0.88)",
              boxShadow: "0 20px 50px -24px rgba(11,94,82,0.55)",
            }}
          >
            {p.ring.check}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
