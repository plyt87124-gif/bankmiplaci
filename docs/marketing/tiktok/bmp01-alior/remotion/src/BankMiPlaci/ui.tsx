import React from "react";
import { B, cardShadow, mono, sans } from "./theme";

// Wspólne klocki wizualne wszystkich scen — trzymają spójny wygląd marki BankMiPłaci.

/** "**x**" w tekście → wyróżnienie kolorem marki */
export const Rich: React.FC<{ text: string; hl?: string; hlWeight?: number }> = ({ text, hl = B.teal600, hlWeight }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") ? (
        <span key={i} style={{ color: hl, fontWeight: hlWeight }}>
          {part.slice(2, -2)}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      background: B.surface,
      borderRadius: 32,
      border: `2px solid ${B.ink100}`,
      boxShadow: cardShadow,
      boxSizing: "border-box",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{ children: React.ReactNode; tone?: "teal" | "ink" | "gold"; style?: React.CSSProperties }> = ({
  children,
  tone = "teal",
  style,
}) => {
  const c = { teal: [B.teal100, B.teal700], ink: [B.ink100, B.ink700], gold: [B.gold100, B.gold600] }[tone];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 24px",
        borderRadius: 999,
        background: c[0],
        color: c[1],
        fontFamily: sans,
        fontWeight: 800,
        fontSize: 30,
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** mały znacznik "Ilustracja" — każda wizualizacja rachunku/produktu jest poglądowa */
export const IllustrationTag: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div
    style={{
      position: "absolute",
      fontFamily: sans,
      fontWeight: 600,
      fontSize: 22,
      color: B.ink500,
      background: "rgba(255,255,255,0.85)",
      border: `1.5px solid ${B.ink100}`,
      borderRadius: 999,
      padding: "6px 16px",
      ...style,
    }}
  >
    {text}
  </div>
);

export const Mono: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span style={{ fontFamily: mono, fontWeight: 700, ...style }}>{children}</span>
);

/** ikona "zbliżeniowo" (3 łuki) — terminal, karty płatności */
export const ContactlessIcon: React.FC<{ size?: number; color?: string; progress?: number }> = ({
  size = 64,
  color = B.teal600,
  progress = 1,
}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    {[12, 22, 32].map((r, i) => (
      <path
        key={r}
        d={`M ${20 + i * 0} ${32 - r * 0.9} A ${r} ${r} 0 0 1 ${20} ${32 + r * 0.9}`}
        transform={`translate(${6 + i * 9} 0)`}
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={Math.max(0, Math.min(1, progress * 3 - i))}
      />
    ))}
  </svg>
);

export const CheckIcon: React.FC<{ size?: number; color?: string; progress?: number; stroke?: number }> = ({
  size = 48,
  color = "#fff",
  progress = 1,
  stroke = 7,
}) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path
      d="M11 25 L20 34 L38 15"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

/** liczba + następne słowo bez łamania linii ("1000 zł", "5 płatnościach") */
export const nb = (s: string) => s.replace(/(\d) /g, "$1 ");
