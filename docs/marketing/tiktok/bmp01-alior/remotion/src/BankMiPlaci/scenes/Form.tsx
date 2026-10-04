import { AbsoluteFill } from "remotion";
import { B, CX, cardShadow, ease, easeInOut, mix, mono, pop, sans, serif } from "../theme";
import { at, local, WORD } from "../timeline";
import { Card, CheckIcon } from "../ui";
import type { SceneProps } from "./types";

// Scena 4: ilustracja wniosku online (bez danych osobowych — pola to szare paski).
// "Konto + karta online" zaznacza się na "Otwierasz konto…", kod PREMIA2026 wpisuje się
// litera po literze razem z lektorem, potem wychodzi na pierwszy plan; zgody zaznaczają się na "zgody".

const FW = 740; // szerokość formularza (przy powiększeniu 1,12 nadal w strefie 90–920 px)
const ROW = { title: 0, skel: 120, product: 250, code: 400, consent: 620, end: 870 };

const Skeleton: React.FC<{ w: number }> = ({ w }) => (
  <div style={{ height: 22, width: w, borderRadius: 11, background: B.ink100 }} />
);

const Box: React.FC<{ on: number; size?: number }> = ({ on, size = 64 }) => (
  <div
    style={{
      flex: `0 0 ${size}px`,
      width: size,
      height: size,
      borderRadius: 18,
      border: `4px solid ${on > 0 ? B.teal600 : B.ink300}`,
      background: on > 0 ? `rgba(15,123,108,${on})` : "#fff",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: `scale(${1 + 0.15 * Math.sin(Math.min(1, on) * Math.PI)})`,
    }}
  >
    <CheckIcon size={size - 14} progress={on} stroke={7} />
  </div>
);

export const FormScene: React.FC<SceneProps> = ({ t, p }) => {
  const L = (f: number) => local("form", f);
  const fProduct = L(at("N", 0.35));
  const fFocusCode = L(at("O")) - 4;
  const fP = L(WORD.premia);
  const f26 = L(WORD.kod2026);
  const fEnd = L(WORD.kodKoniec);
  const fLift = fEnd + 2;
  const fZgody = L(WORD.zgody); // = SFX "click"

  // pisanie kodu: litery między "premia" a "dwa tysiące…", cyfry do końca frazy
  const code = p.form.code;
  const split = code.search(/\d/) < 0 ? code.length : code.search(/\d/);
  const nLetters = Math.max(0, Math.min(split, Math.floor(((t - fP) / Math.max(1, f26 - fP)) * split) + (t >= fP ? 1 : 0)));
  const nDigits = Math.max(0, Math.min(code.length - split, Math.floor(((t - f26) / Math.max(1, fEnd - f26)) * (code.length - split)) + (t >= f26 ? 1 : 0)));
  const typed = code.slice(0, t >= f26 ? split + nDigits : nLetters);
  const focused = t >= fFocusCode && t < fLift + 10;
  const caretOn = focused && Math.floor((t - fFocusCode) / 8) % 2 === 0 && typed.length < code.length;

  // kamera: produkt → pole kodu → zgody
  const c1 = easeInOut(t, [fFocusCode - 10, fFocusCode + 8]);
  const c2 = easeInOut(t, [fLift, fLift + 16]);
  const scale = mix(mix(1.1, 1.12, c1), 1.04, c2);
  const top = mix(mix(190, 186, c1), 330, c2);
  const prodOn = ease(t, [fProduct, fProduct + 8]);
  const consentOn = ease(t, [fZgody, fZgody + 8]);

  // kod wychodzi z pola na pierwszy plan
  const lift = ease(t, [fLift, fLift + 16]);
  const liftPop = pop(t - fLift, 30, 11, 170);
  const fieldCenterY = top + scale * (ROW.code + 120);
  const chipY = mix(fieldCenterY, 215, lift);
  const chipScale = mix(0.62, 1, liftPop);

  const enter = ease(t, [0, 14]);

  return (
    <AbsoluteFill>
      {/* formularz */}
      <div
        style={{
          position: "absolute",
          left: CX - FW / 2,
          top,
          width: FW,
          transform: `scale(${scale}) translateY(${(1 - enter) * 40}px)`,
          transformOrigin: "50% 0%",
        }}
      >
        <Card style={{ width: FW, height: ROW.end, position: "relative", padding: 0 }}>
          {/* tytuł */}
          <div style={{ position: "absolute", left: 44, top: 38, fontFamily: serif, fontWeight: 800, fontSize: 56, color: B.ink }}>{p.form.title}</div>
          {/* dane osobowe — tylko szkielety, bez treści */}
          <div style={{ position: "absolute", left: 44, top: ROW.skel + 14, display: "flex", flexDirection: "column", gap: 18 }}>
            <Skeleton w={420} />
            <Skeleton w={560} />
            <Skeleton w={330} />
          </div>
          {/* produkt */}
          <div
            style={{
              position: "absolute",
              left: 32,
              right: 32,
              top: ROW.product,
              height: 120,
              borderRadius: 24,
              border: `3px solid ${prodOn > 0 ? B.teal600 : B.ink100}`,
              background: prodOn > 0 ? `rgba(220,239,234,${prodOn})` : "#fff",
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "0 26px",
              boxSizing: "border-box",
            }}
          >
            <Box on={prodOn} />
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 44, color: B.ink }}>{p.form.product}</div>
          </div>
          {/* kod promocji */}
          <div style={{ position: "absolute", left: 44, top: ROW.code, fontFamily: sans, fontWeight: 700, fontSize: 32, color: B.ink500 }}>
            {p.form.codeLabel}
          </div>
          <div
            style={{
              position: "absolute",
              left: 32,
              right: 32,
              top: ROW.code + 58,
              height: 124,
              borderRadius: 24,
              border: `4px solid ${focused ? B.teal500 : B.ink100}`,
              boxShadow: focused ? "0 0 0 8px rgba(21,150,131,0.14)" : "none",
              display: "flex",
              alignItems: "center",
              padding: "0 30px",
              boxSizing: "border-box",
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 64,
              letterSpacing: 4,
              color: B.ink,
            }}
          >
            <span style={{ opacity: mix(1, 0.3, lift) }}>{typed}</span>
            <span style={{ width: 5, height: 70, marginLeft: 6, background: B.teal600, opacity: caretOn ? 1 : 0 }} />
          </div>
          {/* zgody */}
          <div style={{ position: "absolute", left: 44, right: 40, top: ROW.consent + 20, display: "flex", gap: 26, alignItems: "flex-start" }}>
            <Box on={consentOn} size={68} />
            <div>
              <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 42, lineHeight: 1.12, color: B.ink }}>{p.form.consent}</div>
              <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 31, lineHeight: 1.25, color: B.ink500, marginTop: 10 }}>{p.form.consentNote}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* PREMIA2026 na pierwszym planie */}
      {t >= fLift && (
        <div
          style={{
            position: "absolute",
            left: CX - 400,
            width: 800,
            top: chipY - 80,
            height: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${chipScale})`,
          }}
        >
          <div
            style={{
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 96,
              letterSpacing: 6,
              color: B.teal700,
              background: "#fff",
              border: `6px solid ${B.teal600}`,
              borderRadius: 30,
              padding: "10px 40px",
              boxShadow: `${cardShadow}, 0 30px 70px -20px rgba(15,123,108,${0.35 + 0.25 * lift})`,
            }}
          >
            {code}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
