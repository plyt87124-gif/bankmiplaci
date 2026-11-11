import React from "react";
import { AbsoluteFill } from "remotion";
import { body, brand, C, CX, ease, H, LAYOUT, W, zl } from "./theme";
import type { Effort, Offer } from "./data";
import { CAPTION_WINDOWS } from "./timeline";

// Klocki wizualne odwzorowujące elementy bankmiplaci.pl (kafel oferty, miernik trudności, odznaki).

export const Rich: React.FC<{ text: string; hl?: string }> = ({ text, hl = C.gold }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") ? (
        <span key={i} style={{ color: hl }}>
          {part.slice(2, -2)}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

/** kwota jak na stronie: cyfry Exo 2, mniejsze „zł” po twardej spacji */
export const Amount: React.FC<{ value: number; size: number; color?: string; style?: React.CSSProperties }> = ({
  value,
  size,
  color = C.ink,
  style,
}) => (
  <span style={{ fontFamily: brand, fontWeight: 600, fontSize: size, lineHeight: 1, color, whiteSpace: "nowrap", letterSpacing: -size * 0.02, fontVariantNumeric: "tabular-nums", ...style }}>
    {zl(value)}
    {" "}
    <span style={{ fontSize: "0.5em", fontWeight: 500 }}>zł</span>
  </span>
);

const EFFORT_LABEL = ["Bardzo łatwa", "Łatwa", "Średnia", "Trudna"];
const EFFORT_COLOR = [C.success, C.success, C.gold, C.ember];

/** miernik trudności — 4 kreski, kolor jak na stronie (zielony / złoty / pomarańczowy) */
export const EffortMeter: React.FC<{ level: Effort; scale?: number }> = ({ level, scale = 1 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 14 * scale }}>
    <span style={{ display: "flex", gap: 4 * scale }}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: 34 * scale,
            height: 12 * scale,
            borderRadius: 4 * scale,
            background: i <= level ? EFFORT_COLOR[level - 1] : C.ink100,
            boxShadow: i <= level ? "none" : `inset 0 0 0 ${2 * scale}px ${C.line}`,
          }}
        />
      ))}
    </span>
    <span style={{ fontFamily: body, fontWeight: 600, fontSize: 30 * scale, color: EFFORT_COLOR[level - 1] }}>{EFFORT_LABEL[level - 1]}</span>
  </span>
);

export const Badge: React.FC<{ children: React.ReactNode; tone?: "neutral" | "warn" | "danger" | "verified"; size?: number; style?: React.CSSProperties }> = ({
  children,
  tone = "neutral",
  size = 26,
  style,
}) => {
  const t = {
    neutral: [C.ink100, C.ink700],
    warn: [C.gold100, C.gold],
    danger: [C.coral100, C.coral],
    verified: ["rgba(120,178,255,0.14)", C.action],
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: `${size * 0.32}px ${size * 0.6}px`,
        borderRadius: size * 0.42,
        background: t[0],
        color: t[1],
        fontFamily: body,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export const CheckMark: React.FC<{ size?: number; color?: string; progress?: number; stroke?: number }> = ({
  size = 34,
  color = C.success,
  progress = 1,
  stroke = 4,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
  </svg>
);

/** kafel oferty jak na stronie (bez logo banku — nazwa tekstem) */
export const OfferTile: React.FC<{ offer: Offer; activeLine: number; urgentPulse?: number; style?: React.CSSProperties }> = ({
  offer,
  activeLine,
  urgentPulse = 0,
  style,
}) => (
  <div
    style={{
      background: C.surface,
      border: `3px solid ${C.line}`,
      borderRadius: 32,
      padding: "48px 48px 46px",
      boxSizing: "border-box",
      ...style,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: brand, fontWeight: 700, fontSize: 40, color: C.ink, letterSpacing: 0.5 }}>{offer.bank}</span>
      <Badge>Osobiste</Badge>
    </div>
    <div style={{ fontFamily: body, fontWeight: 600, fontSize: 34, color: C.ink700, marginTop: 14 }}>{offer.product}</div>
    <div style={{ marginTop: 26, fontFamily: brand, fontWeight: 600, fontSize: 24, letterSpacing: 2.5, textTransform: "uppercase", color: C.ink500 }}>Premia do</div>
    <Amount value={offer.amount} size={180} style={{ display: "block", marginTop: 8 }} />
    {offer.extra ? <div style={{ fontFamily: body, fontWeight: 600, fontSize: 30, color: C.gold, marginTop: 12 }}>{offer.extra}</div> : null}
    <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16 }}>
      <EffortMeter level={offer.effort} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: body, fontWeight: 600, fontSize: 30, color: C.success }}>
        <CheckMark size={32} />
        {offer.feeLine}
      </span>
    </div>
    <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Badge
        tone={offer.deadlineUrgent ? (urgentPulse > 0.5 ? "danger" : "warn") : "neutral"}
        size={28}
        style={{ transform: `scale(${1 + 0.08 * Math.sin(urgentPulse * Math.PI)})`, transformOrigin: "0 50%" }}
      >
        {offer.deadline}
      </Badge>
      {offer.code ? <Badge tone="verified" size={28}>{`Kod ${offer.code}`}</Badge> : null}
    </div>
    <div style={{ marginTop: 36, borderTop: `3px solid ${C.line}`, paddingTop: 32, display: "flex", flexDirection: "column", gap: 22 }}>
      {offer.lines.map((l, i) => {
        const on = i <= activeLine;
        return (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", opacity: on ? 1 : 0.35 }}>
            <span style={{ width: 14, height: 14, marginTop: 15, borderRadius: 7, background: on ? C.action : C.ink300, flexShrink: 0 }} />
            <span style={{ fontFamily: body, fontWeight: on ? 600 : 500, fontSize: 38, lineHeight: 1.25, color: on ? C.ink : C.ink700 }}>{l}</span>
          </div>
        );
      })}
    </div>
  </div>
);

/** granatowe tło z wolnymi niebieskimi poświatami, jak w karuzeli na stronie głównej */
export const Background: React.FC<{ f: number }> = ({ f }) => {
  const t = f / 30;
  const a = { x: 260 + Math.sin(t * 0.33) * 140, y: 420 + Math.cos(t * 0.27) * 160, o: 0.2 + 0.06 * Math.sin(t * 0.9) };
  const b = { x: 820 + Math.cos(t * 0.29) * 120, y: 1300 + Math.sin(t * 0.21) * 180, o: 0.16 + 0.05 * Math.sin(t * 0.7 + 1) };
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(760px 760px at ${a.x}px ${a.y}px, rgba(70,160,255,${a.o}), transparent 70%)`,
            `radial-gradient(700px 700px at ${b.x}px ${b.y}px, rgba(120,178,255,${b.o}), transparent 70%)`,
            `radial-gradient(1200px 900px at 50% 110%, rgba(8,16,26,0.9), transparent 70%)`,
          ].join(","),
        }}
      />
    </AbsoluteFill>
  );
};

/** stały znacznik reklamy (UOKiK: oznaczenie także w samym filmie) */
export const AdTag: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      left: 90,
      top: 96,
      fontFamily: body,
      fontWeight: 700,
      fontSize: 24,
      letterSpacing: 2,
      color: C.ink700,
      background: "rgba(21,32,46,0.85)",
      border: `2px solid ${C.line}`,
      borderRadius: 10,
      padding: "6px 14px",
    }}
  >
    {text}
  </div>
);

/** napisy lektora: ciemny kafel, maks. 2 linie, w pasie nad interfejsem TikToka */
export const Captions: React.FC<{ f: number }> = ({ f }) => {
  const c = CAPTION_WINDOWS.find((w) => f >= w.start && f < w.end);
  if (!c) return null;
  const inP = ease(f - c.start, [0, 6]);
  const outP = ease(c.end - f, [0, 4]);
  const maxW = 800;
  return (
    <div
      style={{
        position: "absolute",
        left: CX - maxW / 2,
        width: maxW,
        top: LAYOUT.captionTop,
        height: LAYOUT.captionBottom - LAYOUT.captionTop,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: body,
          fontWeight: 700,
          fontSize: 50,
          lineHeight: 1.2,
          color: C.ink,
          textAlign: "center",
          background: "rgba(21,32,46,0.94)",
          border: `2px solid ${C.line}`,
          borderRadius: 26,
          padding: "14px 30px 18px",
          opacity: Math.min(inP, outP),
          transform: `translateY(${(1 - inP) * 16}px)`,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textWrap: "balance",
        }}
      >
        <Rich text={c.text} />
      </div>
    </div>
  );
};

export const FULL = { width: W, height: H };
