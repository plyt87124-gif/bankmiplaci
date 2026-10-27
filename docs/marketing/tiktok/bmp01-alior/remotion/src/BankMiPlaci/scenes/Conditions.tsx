import { AbsoluteFill } from "remotion";
import { B, ease, easeInOut, mix, sans } from "../theme";
import { at, local } from "../timeline";
import { Card, nb, Rich } from "../ui";
import type { SceneProps } from "./types";

// Scena 3: CO MIESIĄC PRZEZ 5 MIESIĘCY + trzy karty warunków (lądują na "trzy płatności" /
// "wpływ…" / "logowanie…") + ramka o koszcie karty. Po wylądowaniu ostatniej karty wszystko stoi
// nieruchomo do końca sceny (~2 s), żeby dało się doczytać informację o opłacie.

const LEFT = 90;
const WIDTH = 830;
const CARD_TOP = 452;
const CARD_H = 188;
const CARD_GAP = 26;

const IconCard: React.FC = () => (
  <svg width={64} height={64} viewBox="0 0 64 64" fill="none">
    <rect x="6" y="14" width="52" height="36" rx="7" stroke={B.teal700} strokeWidth="5" />
    <path d="M6 25 H58" stroke={B.teal700} strokeWidth="6" />
    <rect x="13" y="37" width="14" height="5" rx="2.5" fill={B.teal700} />
  </svg>
);
const IconTransfer: React.FC = () => (
  <svg width={64} height={64} viewBox="0 0 64 64" fill="none">
    <path d="M10 26 L32 12 L54 26" stroke={B.teal700} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 30 V48 M26 30 V48 M38 30 V48 M50 30 V48" stroke={B.teal700} strokeWidth="5" strokeLinecap="round" />
    <path d="M8 54 H56" stroke={B.teal700} strokeWidth="5" strokeLinecap="round" />
  </svg>
);
const IconPhone: React.FC = () => (
  <svg width={64} height={64} viewBox="0 0 64 64" fill="none">
    <rect x="17" y="5" width="30" height="54" rx="7" stroke={B.teal700} strokeWidth="5" />
    <path d="M24 32 L30 38 L41 26" stroke={B.teal700} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M28 51 H36" stroke={B.teal700} strokeWidth="4" strokeLinecap="round" />
  </svg>
);
const ICONS = [IconCard, IconTransfer, IconPhone];

export const ConditionsScene: React.FC<SceneProps> = ({ t, p }) => {
  const L = (id: Parameters<typeof at>[0], frac = 0) => local("conditions", at(id, frac));
  const fQ = L("H");
  const fHeader = L("I") - 4;
  const fMonths = [L("I", 0.1), L("I", 0.5), L("I", 0.9), L("J", 0.2), L("J", 0.7)];
  const fLand = [L("K") - 2, L("L") - 2, L("M") - 2]; // = SFX "click"
  const fFee = fLand[0] + 16;

  // krótkie pytanie, które ustępuje miejsca stałemu nagłówkowi
  const qIn = ease(t, [fQ - 4, fQ + 6]);
  const qOut = easeInOut(t, [fHeader - 6, fHeader + 6]);
  const hIn = ease(t, [fHeader, fHeader + 14]);
  const feeIn = ease(t, [fFee, fFee + 16]);

  return (
    <AbsoluteFill>
      {qOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: LEFT,
            width: WIDTH,
            top: 560,
            textAlign: "center",
            fontFamily: sans,
            fontWeight: 900,
            fontSize: 104,
            lineHeight: 1.05,
            textWrap: "balance",
            color: B.ink,
            opacity: qIn * (1 - qOut),
            transform: `scale(${mix(0.9, 1, qIn) * mix(1, 0.7, qOut)}) translateY(${-qOut * 260}px)`,
          }}
        >
          <Rich text={p.conditions.question} hl={B.teal600} />
        </div>
      )}

      {/* stały nagłówek + pasek 5 miesięcy */}
      <div
        style={{
          position: "absolute",
          left: LEFT,
          width: WIDTH,
          top: 112,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: hIn,
          transform: `translateY(${(1 - hIn) * 40}px)`,
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontWeight: 900,
            fontSize: 62,
            lineHeight: 1.04,
            letterSpacing: 0.5,
            color: B.ink,
            textAlign: "center",
            textWrap: "balance",
          }}
        >
          {p.conditions.header}
        </div>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 32, color: B.ink500, marginTop: 10 }}>{p.conditions.headerSub}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
          {fMonths.map((f, i) => {
            const k = ease(t, [f, f + 8]);
            return (
              <div
                key={i}
                style={{
                  width: 120,
                  height: 46,
                  borderRadius: 23,
                  background: k > 0 ? `rgba(15,123,108,${0.15 + 0.85 * k})` : B.ink100,
                  color: k > 0.5 ? "#fff" : B.ink500,
                  fontFamily: sans,
                  fontWeight: 800,
                  fontSize: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${1 + 0.12 * Math.sin(k * Math.PI)})`,
                }}
              >
                {`${i + 1}. mies.`}
              </div>
            );
          })}
        </div>
      </div>

      {/* trzy karty warunków */}
      {p.conditions.cards.map((c, i) => {
        const f = fLand[i];
        // wejście bez sprężyny: kończy się DOKŁADNIE w klatce lądowania, potem zero ruchu
        const k = ease(t, [f - 14, f]);
        const Icon = ICONS[i % ICONS.length];
        const flash = t >= f ? Math.max(0, 1 - (t - f) / 10) : 0;
        return (
          <div key={i} style={{ position: "absolute", left: LEFT, width: WIDTH, top: CARD_TOP + i * (CARD_H + CARD_GAP), perspective: 900 }}>
            <Card
              style={{
                height: CARD_H,
                display: "flex",
                alignItems: "center",
                gap: 28,
                padding: "0 34px",
                opacity: t < f - 14 ? 0 : Math.min(1, k * 1.8),
                transform: `translateY(${(1 - k) * -150}px) rotateX(${(1 - k) * 28}deg) scale(${mix(1.06, 1, k)})`,
                transformOrigin: "50% 0%",
                borderColor: flash > 0 ? `rgba(21,150,131,${0.25 + 0.6 * flash})` : B.ink100,
              }}
            >
              <div
                style={{
                  width: 104,
                  height: 104,
                  flex: "0 0 104px",
                  borderRadius: 28,
                  background: B.teal100,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 42, lineHeight: 1.1, color: B.ink, textWrap: "balance" }}>{nb(c.title)}</div>
                <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 30, color: B.ink500, marginTop: 8 }}>{c.detail}</div>
              </div>
            </Card>
          </div>
        );
      })}

      {/* koszt karty — spokojna ramka nad interfejsem TikToka */}
      <div
        style={{
          position: "absolute",
          left: LEFT,
          width: WIDTH,
          top: CARD_TOP + 3 * (CARD_H + CARD_GAP) + 6,
          opacity: feeIn,
          transform: `translateY(${(1 - feeIn) * 24}px)`,
        }}
      >
        <div
          style={{
            background: "#FFFBF2",
            border: `3px solid ${B.gold600}`,
            borderRadius: 28,
            padding: "22px 30px 24px",
            display: "flex",
            gap: 22,
            boxShadow: "0 16px 36px -22px rgba(169,130,42,0.6)",
          }}
        >
          <div
            style={{
              flex: "0 0 52px",
              width: 52,
              height: 52,
              borderRadius: 26,
              background: B.gold600,
              color: "#fff",
              fontFamily: sans,
              fontWeight: 900,
              fontSize: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            i
          </div>
          <div>
            <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 30, color: B.gold600, letterSpacing: 1.5, textTransform: "uppercase" }}>
              {p.conditions.feeTitle}
            </div>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 35, lineHeight: 1.22, color: B.ink, marginTop: 6 }}>{nb(p.conditions.feeNote)}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
