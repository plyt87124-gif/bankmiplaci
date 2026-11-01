import { AbsoluteFill, Img, staticFile } from "remotion";
import { CATCH, END, HOOK, OFFERS, PAYOUTS } from "./data";
import { body, brand, C, CX, ease, easeInOut, mix, pop } from "./theme";
import { K, local, ws } from "./timeline";
import { Amount, Badge, CheckMark, OfferTile } from "./ui";

export type SceneProps = { t: number; dur: number };

// ---------- 1. Hook: DO 2 900 ZŁ od pierwszej klatki ----------
export const HookScene: React.FC<SceneProps> = ({ t }) => {
  const settle = pop(t + 4, 11, 200);
  const bar = ease(t, [3, 20]);
  const chipAt = [ws("pół"), K.fourAccounts, K.oneSalary].map((f) => local("hook", f));
  const assume = ease(t, [local("hook", K.oneSalary) + 10, local("hook", K.oneSalary) + 22]);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: CX - 450, width: 900, top: 330, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontFamily: brand, fontWeight: 700, fontSize: 120, color: C.action, letterSpacing: 6, lineHeight: 1, transform: `translateY(${(1 - settle) * -30}px)` }}>
          {HOOK.prefix}
        </div>
        <div style={{ transform: `scale(${mix(1.12, 1, settle)})`, marginTop: 6 }}>
          <Amount value={HOOK.amount} size={250} />
        </div>
        {/* niebieska kreska spod „mi” w logo */}
        <div style={{ marginTop: 18, height: 22, width: 560 * bar, borderRadius: 11, background: C.brandSoft }} />
      </div>
      <div style={{ position: "absolute", left: CX - 415, width: 830, top: 880, display: "flex", justifyContent: "center", gap: 18 }}>
        {HOOK.chips.map((c, i) => {
          const k = t >= chipAt[i] - 3 ? pop(t - chipAt[i] + 3, 10, 220) : 0;
          return (
            <div
              key={c}
              style={{
                fontFamily: brand,
                fontWeight: 600,
                fontSize: 52,
                color: C.ink,
                background: C.surface,
                border: `3px solid ${C.line}`,
                borderRadius: 22,
                padding: "12px 30px",
                opacity: Math.min(1, k * 1.5),
                transform: `translateY(${(1 - k) * 40}px) scale(${mix(0.7, 1, k)})`,
              }}
            >
              {c}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: CX - 380,
          width: 760,
          top: 1050,
          background: "rgba(21,32,46,0.9)",
          border: `3px solid ${C.line}`,
          borderRadius: 28,
          padding: "24px 34px",
          opacity: assume,
          transform: `translateY(${(1 - assume) * 30}px)`,
        }}
      >
        <div style={{ fontFamily: brand, fontWeight: 600, fontSize: 26, letterSpacing: 2.5, textTransform: "uppercase", color: C.ink500 }}>{HOOK.assumptionsTitle}</div>
        {HOOK.assumptions.map((a) => (
          <div key={a} style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12 }}>
            <CheckMark size={30} color={C.action} />
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 32, color: C.ink700 }}>{a}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 2. Cztery konta: kafle jak na stronie + suma ----------
const BANK_ANCHORS = () => [
  { from: K.millennium, amountAt: ws("ośmiuset", 1), lines: [K.milSalary, K.milCard, K.milCard + 40] },
  { from: K.alior, amountAt: ws("ośmiuset", 2), lines: [K.aliorPay, K.aliorTransfer, K.aliorTransfer + 30] },
  { from: K.erste, amountAt: ws("siedmiuset"), lines: [ws("siedmiuset") + 20, ws("wniosek"), ws("listopada")] },
  { from: K.pko, amountAt: ws("sześciuset"), lines: [K.pkoPercent, K.pkoPercent + 25, K.pkoPercent + 45] },
];

export const BanksScene: React.FC<SceneProps> = ({ t }) => {
  const A = BANK_ANCHORS().map((a) => ({
    from: local("banks", a.from) - 6,
    amountAt: local("banks", a.amountAt),
    lines: a.lines.map((x) => local("banks", x)),
  }));
  const idx = A.reduce((acc, a, i) => (t >= a.from ? i : acc), 0);
  // suma rośnie, gdy lektor wypowiada kwotę (agregat, więc licznik jest dozwolony)
  const reached = A.map((a, i) => ({ v: OFFERS[i].amount, k: ease(t, [a.amountAt, a.amountAt + 12]) }));
  const total = Math.round(reached.reduce((s, r) => s + r.v * r.k, 0) / 10) * 10;
  return (
    <AbsoluteFill>
      {/* pasek sumy i czterech miejsc */}
      <div style={{ position: "absolute", left: 90, width: 830, top: 170, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {OFFERS.map((o, i) => {
            const k = reached[i].k;
            return (
              <div
                key={o.bank}
                style={{
                  width: 118,
                  height: 92,
                  borderRadius: 20,
                  border: `3px ${k > 0 ? "solid" : "dashed"} ${k > 0 ? C.action : C.line}`,
                  background: k > 0 ? "rgba(120,178,255,0.12)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: brand,
                  fontWeight: 700,
                  fontSize: 32,
                  color: k > 0 ? C.ink : C.ink300,
                  transform: `scale(${1 + 0.12 * Math.sin(Math.min(1, k) * Math.PI)})`,
                }}
              >
                {k > 0 ? o.amount : i + 1}
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: brand, fontWeight: 600, fontSize: 24, letterSpacing: 2.5, color: C.ink500 }}>SUMA</div>
          <Amount value={total} size={84} color={C.gold} />
        </div>
      </div>
      {OFFERS.map((o, i) => {
        const a = A[i];
        const next = A[i + 1];
        const inP = ease(t, [a.from, a.from + 14]);
        const outP = next ? easeInOut(t, [next.from, next.from + 12]) : 0;
        if (inP <= 0 || outP >= 1) return null;
        const activeLine = a.lines.reduce((acc, f, li) => (t >= f ? li : acc), -1);
        const urgent = o.deadlineUrgent ? ease(t, [a.lines[1] - 4, a.lines[1] + 8]) : 0;
        const amountPop = t >= a.amountAt ? pop(t - a.amountAt, 9, 240) : 0;
        return (
          <div
            key={o.bank}
            style={{
              position: "absolute",
              left: 90,
              width: 830,
              top: 300,
              opacity: inP * (1 - outP),
              transform: `translateX(${(1 - inP) * 260 - outP * 300}px) scale(${mix(0.94, 1, inP) * mix(1, 0.9, outP)}) rotate(${(1 - inP) * 3}deg)`,
              filter: i === idx ? undefined : "brightness(0.9)",
            }}
          >
            <OfferTile
              offer={o}
              activeLine={activeLine}
              urgentPulse={urgent}
              style={{ boxShadow: `0 0 0 ${amountPop > 0 && amountPop < 1.05 ? 6 * (1 - Math.min(1, amountPop)) : 0}px ${C.action}` }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- 3. Kalendarz wypłat ----------
export const CalendarScene: React.FC<SceneProps> = ({ t }) => {
  const g = local("calendar", K.grudnia);
  const max = Math.max(...PAYOUTS.map((p) => p.amount));
  const sum = PAYOUTS.reduce((s, p) => s + p.amount, 0);
  const sumIn = ease(t, [local("calendar", K.czerwca), local("calendar", K.czerwca) + 10]);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 90, width: 830, top: 200, textAlign: "center", fontFamily: brand, fontWeight: 700, fontSize: 64, color: C.ink, lineHeight: 1.1 }}>
        Premie co miesiąc
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 32, color: C.ink500, marginTop: 12 }}>najpóźniej do końca miesiąca · konta z listopada</div>
      </div>
      <div style={{ position: "absolute", left: 100, width: 810, top: 420, height: 720, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        {PAYOUTS.map((p, i) => {
          const k = t >= g + i * 4 - 8 ? pop(t - (g + i * 4 - 8), 11, 200) : 0;
          const h = (p.amount / max) * 520;
          return (
            <div key={p.month} style={{ width: 100, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontFamily: brand, fontWeight: 700, fontSize: 34, color: C.gold, opacity: Math.min(1, k * 1.4), marginBottom: 10 }}>{p.amount}</div>
              <div style={{ width: 84, height: Math.max(0, h * Math.min(1, k)), borderRadius: "16px 16px 6px 6px", background: `linear-gradient(${C.gold}, #B88A2E)` }} />
              <div style={{ fontFamily: body, fontWeight: 600, fontSize: 32, color: C.ink700, marginTop: 14 }}>{p.month}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 90, width: 830, top: 1210, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 20, opacity: sumIn, transform: `translateY(${(1 - sumIn) * 20}px)` }}>
        <span style={{ fontFamily: brand, fontWeight: 600, fontSize: 48, color: C.ink700 }}>razem do</span>
        <Amount value={sum} size={110} color={C.gold} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 4. Haczyk ----------
export const CatchScene: React.FC<SceneProps> = ({ t }) => {
  const h = pop(t - local("catch", K.haczyk), 9, 230);
  const c = local("catch", K.conditions);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 90, width: 830, top: 220, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: brand,
            fontWeight: 700,
            fontSize: 130,
            color: C.coral,
            border: `8px solid ${C.coral}`,
            borderRadius: 30,
            padding: "4px 40px 10px",
            transform: `scale(${mix(1.6, 1, h)}) rotate(${mix(-10, -3, h)}deg)`,
            opacity: Math.min(1, h * 1.5),
          }}
        >
          {CATCH.title}
        </div>
      </div>
      <div style={{ position: "absolute", left: 90, width: 830, top: 520, textAlign: "center", fontFamily: body, fontWeight: 600, fontSize: 40, color: C.ink, opacity: ease(t, [c - 6, c + 6]) }}>
        {CATCH.sub}
      </div>
      <div style={{ position: "absolute", left: 90, width: 830, top: 630, display: "flex", flexDirection: "column", gap: 18 }}>
        {OFFERS.map((o, r) => (
          <div key={o.bank} style={{ display: "flex", alignItems: "center", gap: 14, opacity: ease(t, [c - 6 + r * 3, c + 4 + r * 3]) }}>
            <div style={{ width: 250, fontFamily: brand, fontWeight: 600, fontSize: 34, color: C.ink }}>{o.bank}</div>
            {CATCH.months.map((m, i) => {
              const active = i < [6, 5, 3, 5][r]; // Millennium gru–maj, Alior gru–kwi, Erste gru–lut, PKO gru–kwi
              const k = ease(t, [c + 4 + i * 4 + r * 2, c + 12 + i * 4 + r * 2]);
              return (
                <div key={m} style={{ width: 80, height: 80, borderRadius: 16, border: `3px solid ${active ? C.action : C.line}`, background: active ? "rgba(120,178,255,0.10)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {active ? <CheckMark size={44} color={C.action} progress={k} stroke={3.5} /> : null}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
          <div style={{ width: 250 }} />
          {CATCH.months.map((m) => (
            <div key={m} style={{ width: 80, textAlign: "center", fontFamily: body, fontWeight: 600, fontSize: 26, color: C.ink500 }}>{m}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 5. Koniec: plan na stronie + adres + CTA ----------
export const EndScene: React.FC<SceneProps> = ({ t }) => {
  const inP = ease(t, [0, 18]);
  const url = ease(t, [local("end", K.url) - 4, local("end", K.url) + 12]);
  const cta = ease(t, [local("end", K.url) + 20, local("end", K.url) + 34]);
  const small = ease(t, [local("end", K.url) + 30, local("end", K.url) + 44]);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: CX - 300, width: 600, top: 150, display: "flex", justifyContent: "center", opacity: inP }}>
        <Img src={staticFile("bmp02/logo-dark.png")} style={{ width: 520 }} />
      </div>
      {/* kafel „ściągi” w stylu strony */}
      <div
        style={{
          position: "absolute",
          left: 90,
          width: 830,
          top: 330,
          background: C.surface,
          border: `3px solid ${C.line}`,
          borderRadius: 32,
          padding: "34px 40px",
          boxSizing: "border-box",
          opacity: inP,
          transform: `translateY(${(1 - inP) * 60}px)`,
        }}
      >
        <Badge tone="verified" size={26}>Ściąga · przypomnienia e-mail</Badge>
        <div style={{ fontFamily: brand, fontWeight: 700, fontSize: 46, color: C.ink, marginTop: 18 }}>{END.cardTitle}</div>
        {END.cardRows.map((r, i) => {
          const k = ease(t, [12 + i * 8, 20 + i * 8]);
          return (
            <div key={r} style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 16, opacity: mix(0.3, 1, k) }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, border: `3px solid ${k > 0.5 ? C.success : C.lineStrong}`, background: k > 0.5 ? C.success100 : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckMark size={30} progress={k} />
              </div>
              <span style={{ fontFamily: body, fontWeight: 500, fontSize: 32, color: C.ink700 }}>{r}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 90, width: 830, top: 860, textAlign: "center", opacity: url, transform: `scale(${mix(0.92, 1, url)})` }}>
        <span style={{ fontFamily: brand, fontWeight: 700, fontSize: 112, color: C.ink, letterSpacing: -1 }}>
          bank<span style={{ color: C.brandSoft }}>mi</span>placi<span style={{ color: C.action }}>.pl</span>
        </span>
      </div>
      <div style={{ position: "absolute", left: 90, width: 830, top: 1020, display: "flex", justifyContent: "center", opacity: cta, transform: `translateY(${(1 - cta) * 24}px)` }}>
        <div style={{ background: C.action, color: C.onAction, fontFamily: brand, fontWeight: 700, fontSize: 46, borderRadius: 999, padding: "26px 46px" }}>{END.cta}</div>
      </div>
      <div style={{ position: "absolute", left: 120, width: 770, top: 1180, textAlign: "center", fontFamily: body, fontWeight: 500, fontSize: 26, lineHeight: 1.35, color: C.ink500, opacity: small, textWrap: "balance" }}>
        {END.small}
      </div>
    </AbsoluteFill>
  );
};

