import { AbsoluteFill } from "remotion";
import { B, CX, easeInOut, sans } from "../theme";
import { at, local } from "../timeline";
import { Card, nb } from "../ui";
import type { SceneProps } from "./types";

// Scena 5: spokojna plansza "dla kogo + do kiedy" — tylko łagodne wejścia (bez sprężyn),
// żeby wyhamować tempo przed końcowym wezwaniem do działania.

const LEFT = 90;
const WIDTH = 830;
const MONTHS = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];

const Calendar: React.FC<{ day: string; month: string }> = ({ day, month }) => (
  <div
    style={{
      flex: "0 0 150px",
      width: 150,
      height: 160,
      borderRadius: 30,
      background: "#fff",
      border: `3px solid ${B.ink100}`,
      boxShadow: "0 14px 30px -18px rgba(14,27,42,0.4)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        height: 50,
        background: B.teal600,
        color: "#fff",
        fontFamily: sans,
        fontWeight: 900,
        fontSize: 30,
        letterSpacing: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {month}
    </div>
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 900, fontSize: 76, color: B.ink }}>
      {day}
    </div>
  </div>
);

export const EligibilityScene: React.FC<SceneProps> = ({ t, p }) => {
  const L = (id: Parameters<typeof at>[0], frac = 0) => local("eligibility", at(id, frac));
  const fTitle = L("Q") - 4;
  const fWho = L("Q", 0.45);
  const fDeadline = L("R") - 4;
  const fTerms = L("R", 0.6);

  const soft = (f: number) => easeInOut(t, [f, f + 18]);
  const title = soft(fTitle);
  const who = soft(fWho);
  const dl = soft(fDeadline);
  const terms = soft(fTerms);

  const [badge, ...rest] = p.eligibility.who.split(" • ");
  const whoText = rest.join(" • ");
  const m = p.eligibility.deadline.match(/(\d{1,2})\.(\d{1,2})\.\d{4}/);
  const day = m ? String(Number(m[1])) : "";
  const month = m ? MONTHS[Number(m[2]) - 1] ?? "" : "";

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: LEFT,
          width: WIDTH,
          top: 200,
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 900,
          fontSize: 74,
          lineHeight: 1.05,
          color: B.ink,
          textWrap: "balance",
          opacity: title,
          transform: `translateY(${(1 - title) * 30}px)`,
        }}
      >
        {p.eligibility.title}
      </div>

      {/* dla kogo */}
      <Card
        style={{
          position: "absolute",
          left: LEFT,
          width: WIDTH,
          top: 450,
          padding: "36px 36px",
          display: "flex",
          alignItems: "center",
          gap: 30,
          opacity: who,
          transform: `translateY(${(1 - who) * 40}px)`,
        }}
      >
        <div
          style={{
            flex: "0 0 140px",
            width: 140,
            height: 140,
            borderRadius: 70,
            background: B.ink,
            color: "#fff",
            fontFamily: sans,
            fontWeight: 900,
            fontSize: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge}
        </div>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 42, lineHeight: 1.15, color: B.ink, textWrap: "balance" }}>{nb(whoText)}</div>
      </Card>

      {/* termin */}
      <div
        style={{
          position: "absolute",
          left: LEFT,
          width: WIDTH,
          top: 790,
          display: "flex",
          alignItems: "center",
          gap: 34,
          padding: "0 10px",
          boxSizing: "border-box",
          opacity: dl,
          transform: `translateY(${(1 - dl) * 40}px)`,
        }}
      >
        <Calendar day={day} month={month} />
        <div>
          <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 56, lineHeight: 1.05, color: B.teal700, whiteSpace: "nowrap" }}>
            {p.eligibility.deadline.replace(/\s(\d)/, " $1")}
          </div>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 33, lineHeight: 1.2, color: B.ink500, marginTop: 10 }}>{p.eligibility.deadlineSub}</div>
        </div>
      </div>

      {/* zasady */}
      <div
        style={{
          position: "absolute",
          left: CX - 380,
          width: 760,
          top: 1080,
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 33,
          lineHeight: 1.3,
          color: B.ink500,
          textWrap: "balance",
          opacity: terms,
        }}
      >
        {p.eligibility.terms}
      </div>
    </AbsoluteFill>
  );
};
