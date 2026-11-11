import { AbsoluteFill } from "remotion";
import { B, CX, cardShadow, ease, easeInOut, mix, mono, pop, sans } from "../theme";
import { at, endOf, local } from "../timeline";
import { Card, Pill } from "../ui";
import type { SceneProps } from "./types";

// Scena 2: oś nagród w etapach (nie potwierdzenie przelewu). Węzły pojawiają się dokładnie na
// "dwieście na start" / "dwieście za aktywność" / "i do czterech razy po sto", potem licznik DO 800 ZŁ.

const AXIS_X = 168;
const CARD_L = 222;
const CARD_W = 920 - CARD_L;
const ROWS = [262, 517, 772]; // górne krawędzie kart
const CARD_H = 235;

export const PayoutScene: React.FC<SceneProps> = ({ t, dur, p }) => {
  const L = (id: Parameters<typeof at>[0], frac = 0) => local("payout", at(id, frac));
  const fHead = L("D");
  const fNodes = [L("E"), L("F"), L("G")];
  const fPop = local("payout", endOf("G")) - 6; // = SFX "pop"
  const fCount = fPop - 20;

  const head = pop(t - fHead + 2, 30, 12, 160);
  const drift = easeInOut(t, [0, dur + 10], [10, -18]); // powolna paralaksa całej osi

  // linia osi rysuje się do kolejnych węzłów
  const nodeY = ROWS.map((y) => y + CARD_H / 2);
  const lineTop = nodeY[0];
  const lineTarget = fNodes.reduce((acc, f, i) => (t >= f - 6 ? nodeY[i] : acc), lineTop);
  const linePrev = fNodes.reduce((acc, f, i) => (t >= f - 6 && i > 0 ? nodeY[i - 1] : acc), lineTop);
  const lastF = [...fNodes].reverse().find((f) => t >= f - 6) ?? fNodes[0];
  const lineEnd = mix(linePrev, lineTarget, ease(t, [lastF - 6, lastF + 2]));

  const count = Math.round(800 * ease(t, [fCount, fPop], [0, 1], (x) => 1 - Math.pow(1 - x, 3)));
  const totalIn = ease(t, [fCount - 6, fCount + 4]);
  const totalPop = t >= fPop ? pop(t - fPop, 30, 8, 260) : 0;
  const noteIn = ease(t, [fPop + 2, fPop + 12]);

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center", paddingRight: 1080 - 2 * CX }}>
        <div style={{ opacity: Math.min(1, head * 1.4), transform: `translateY(${(1 - head) * -30}px) scale(${mix(0.85, 1, head)})` }}>
          <Pill tone="ink" style={{ fontSize: 42, padding: "16px 34px", letterSpacing: 2, background: B.ink, color: "#fff" }}>
            {p.payout.product}
          </Pill>
        </div>
      </div>

      <AbsoluteFill style={{ transform: `translateY(${drift}px)` }}>
        {/* oś */}
        <div style={{ position: "absolute", left: AXIS_X - 3, top: lineTop, width: 6, height: nodeY[2] - lineTop, borderRadius: 3, background: B.ink100 }} />
        {t >= fNodes[0] - 6 && (
          <div
            style={{
              position: "absolute",
              left: AXIS_X - 3,
              top: lineTop,
              width: 6,
              height: Math.max(0, lineEnd - lineTop),
              borderRadius: 3,
              background: `linear-gradient(${B.teal500}, ${B.teal700})`,
            }}
          />
        )}

        {/* puste miejsca na 3 etapy — pojawiają się z nazwą konta, wypełniają na kolejnych słowach */}
        {ROWS.map((y, i) => {
          const g = ease(t, [fHead + 6 + i * 5, fHead + 18 + i * 5]);
          const filled = ease(t, [fNodes[i] - 4, fNodes[i] + 4]);
          return (
            <div
              key={`ghost-${i}`}
              style={{
                position: "absolute",
                left: CARD_L,
                top: y,
                width: CARD_W,
                height: CARD_H,
                borderRadius: 32,
                border: `3px dashed ${B.ink100}`,
                boxSizing: "border-box",
                opacity: g * (1 - filled),
                transform: `translateY(${(1 - g) * 30}px)`,
                display: "flex",
                alignItems: "center",
                paddingLeft: 30,
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 44,
                color: B.ink300,
              }}
            >
              {`${i + 1}.`}
            </div>
          );
        })}

        {p.payout.steps.map((s, i) => {
          const f = fNodes[i];
          const k = pop(t - f + 4, 30, 12, 180);
          const dot = ease(t, [f - 4, f + 2]);
          const ring = t >= f ? (t - f) / 18 : -1;
          const isLast = i === p.payout.steps.length - 1;
          return (
            <div key={i}>
              {/* węzeł */}
              <div
                style={{
                  position: "absolute",
                  left: AXIS_X - 22,
                  top: nodeY[i] - 22,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  background: dot > 0 ? B.teal600 : B.surface,
                  border: `5px solid ${dot > 0 ? B.teal100 : B.ink100}`,
                  boxSizing: "border-box",
                  transform: `scale(${0.6 + 0.4 * dot + (ring >= 0 && ring < 1 ? 0.25 * Math.sin(ring * Math.PI) : 0)})`,
                }}
              />
              {ring >= 0 && ring < 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: AXIS_X - 22 - ring * 40,
                    top: nodeY[i] - 22 - ring * 40,
                    width: 44 + ring * 80,
                    height: 44 + ring * 80,
                    borderRadius: 999,
                    border: `4px solid ${B.teal500}`,
                    opacity: 1 - ring,
                    boxSizing: "border-box",
                  }}
                />
              )}
              {/* karta etapu */}
              <Card
                style={{
                  position: "absolute",
                  left: CARD_L,
                  top: ROWS[i],
                  width: CARD_W,
                  height: CARD_H,
                  padding: "20px 30px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  opacity: t < f - 4 ? 0 : Math.min(1, k * 1.5),
                  transform: `translateX(${(1 - k) * 160}px) scale(${mix(0.92, 1, k)})`,
                  transformOrigin: "0% 50%",
                  boxShadow: cardShadow,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                  <div
                    style={{
                      fontFamily: mono,
                      fontWeight: 700,
                      fontSize: 48,
                      color: B.teal700,
                      background: B.teal100,
                      borderRadius: 18,
                      padding: "6px 20px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.amount}
                  </div>
                  {isLast && (
                    <div style={{ display: "flex", gap: 10 }}>
                      {[0, 1, 2, 3].map((c) => {
                        const ck = pop(t - f - 3 - c * 5, 30, 10, 220);
                        return (
                          <div
                            key={c}
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 23,
                              background: `radial-gradient(circle at 35% 30%, #F4EAD2, ${B.gold600})`,
                              boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.15)",
                              fontFamily: mono,
                              fontWeight: 700,
                              fontSize: 17,
                              color: "#5B4410",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: t < f + 3 + c * 5 ? 0 : 1,
                              transform: `translateY(${(1 - ck) * -40}px) scale(${mix(0.5, 1, ck)})`,
                            }}
                          >
                            100
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 38, color: B.ink, marginTop: 12, lineHeight: 1.1 }}>{s.label}</div>
                <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 30, color: B.ink500, marginTop: 6, lineHeight: 1.15 }}>{s.detail}</div>
              </Card>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* suma: DO 800 ZŁ (DO widoczne przez cały czas liczenia) */}
      <div
        style={{
          position: "absolute",
          left: CX - 415,
          width: 830,
          top: 1062,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: totalIn,
          transform: `translateY(${(1 - totalIn) * 40}px) scale(${1 + 0.08 * Math.sin(Math.min(1, totalPop) * Math.PI)})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: sans, fontWeight: 900, fontSize: 92, color: B.teal600, letterSpacing: 2 }}>{p.payout.totalPrefix}</span>
          <span style={{ fontFamily: sans, fontWeight: 900, fontSize: 150, color: B.ink, letterSpacing: -4, fontVariantNumeric: "tabular-nums" }}>
            {p.payout.total.replace(/\d+/, t >= fPop ? "$&" : String(count))}
          </span>
        </div>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 34, color: B.ink500, marginTop: 4, opacity: noteIn }}>{p.payout.note}</div>
      </div>
    </AbsoluteFill>
  );
};
