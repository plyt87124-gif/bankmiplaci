import { AbsoluteFill, Img, staticFile } from "remotion";
import { B, CX, ease, easeInOut, mix, sans, serif } from "../theme";
import { at, local } from "../timeline";
import type { SceneProps } from "./types";

// Scena 6: prawdziwy zrzut publicznej strony promocji (widok mobilny) w makiecie telefonu →
// przewinięcie do "Co musisz zrobić?" i zbliżenie pierwszego kroku → bankmiplaci.pl + jedno CTA.
// Końcowy kadr jest kompletny ≥ 2 s przed końcem filmu i prawie się nie rusza.

const SCREEN_W = 560; // szerokość ekranu telefonu w px kadru
const SCREEN_H = 1000;
const BEZEL = 18;
const MAX_CSS_Y = 3300; // poniżej jest sekcja z kosztami — nie pokazujemy jej

export const EndCardScene: React.FC<SceneProps> = ({ t, p }) => {
  const L = (id: Parameters<typeof at>[0], frac = 0) => local("end", at(id, frac));
  const fScroll = L("S", 0.15); // chwilę widać górę strony (nagłówek promocji), potem przewijanie
  const fZoom = fScroll + 22;
  const fSettle = L("T") - 2;
  const fUrl = L("T") + 4;
  const fCta = L("T", 0.45);
  const fSmall = fCta + 6; // pełny końcowy kadr gotowy ok. 2,3 s przed końcem filmu

  const pxPerCss = SCREEN_W / p.end.screenshotCssWidth;
  // przewijanie: od góry strony do nagłówka "Co musisz zrobić?" (z małym marginesem nad nim)
  const targetCss = Math.min(p.end.scrollToCssY - 40, MAX_CSS_Y - SCREEN_H / pxPerCss);
  const scroll = easeInOut(t, [fScroll, fScroll + 24]) * targetCss;
  // zbliżenie na pierwszy krok (lewa-górna część karty kroku)
  const zoom = easeInOut(t, [fZoom, fZoom + 16], [1, 1.32]);

  // telefon: wjazd od dołu → po zbliżeniu odjeżdża w górę i maleje
  const inP = ease(t, [0, 20]);
  const settle = easeInOut(t, [fSettle, fSettle + 22]);
  const phoneScale = mix(1, 0.66, settle);
  const phoneTop = mix(mix(1500, 170, inP), 112, settle);
  const tilt = mix(mix(10, 0, inP), -3, settle);
  const idle = Math.sin(t * 0.05) * 3 * settle; // bardzo delikatne unoszenie w końcowym kadrze

  const url = ease(t, [fUrl, fUrl + 16]);
  const cta = ease(t, [fCta, fCta + 14]);
  const small = ease(t, [fSmall, fSmall + 14]);
  const ctaPulse = t > fCta + 30 ? 1 + 0.015 * Math.sin((t - fCta) * 0.18) : 1;

  const [urlMain, urlTld] = (() => {
    const i = p.end.url.lastIndexOf(".");
    return i > 0 ? [p.end.url.slice(0, i), p.end.url.slice(i)] : [p.end.url, ""];
  })();

  return (
    <AbsoluteFill>
      {/* telefon */}
      <div
        style={{
          position: "absolute",
          left: CX - SCREEN_W / 2 - BEZEL,
          top: phoneTop + idle,
          width: SCREEN_W + 2 * BEZEL,
          height: SCREEN_H + 2 * BEZEL,
          borderRadius: 86,
          background: "linear-gradient(145deg, #2B3A4C 0%, #0E1B2A 45%, #1A2737 100%)",
          boxShadow: "0 50px 90px -40px rgba(14,27,42,0.6), inset 0 0 0 2px rgba(255,255,255,0.12)",
          transform: `scale(${phoneScale}) rotate(${tilt}deg)`,
          transformOrigin: "50% 0%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: BEZEL,
            top: BEZEL,
            width: SCREEN_W,
            height: SCREEN_H,
            borderRadius: 68,
            overflow: "hidden",
            background: B.paper,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: SCREEN_W,
              transform: `scale(${zoom})`,
              transformOrigin: `12% ${(70 / SCREEN_H) * 100}%`,
            }}
          >
            <Img
              src={staticFile(p.end.screenshot)}
              style={{ position: "absolute", left: 0, top: -scroll * pxPerCss, width: SCREEN_W, display: "block" }}
            />
          </div>
          {/* odblask szkła */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(115deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.08) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
        {/* wyspa */}
        <div style={{ position: "absolute", left: "50%", top: BEZEL + 18, width: 150, height: 40, marginLeft: -75, borderRadius: 20, background: "#05090E" }} />
      </div>

      {/* adres */}
      <div
        style={{
          position: "absolute",
          left: CX - 415,
          width: 830,
          top: 818,
          textAlign: "center",
          fontFamily: serif,
          fontWeight: 800,
          fontSize: 112,
          letterSpacing: -2,
          color: B.ink,
          opacity: url,
          transform: `translateY(${(1 - url) * 40}px) scale(${mix(0.94, 1, url)})`,
        }}
      >
        {urlMain}
        <span style={{ color: B.teal600 }}>{urlTld}</span>
      </div>

      {/* CTA */}
      <div
        style={{
          position: "absolute",
          left: CX - 415,
          width: 830,
          top: 990,
          display: "flex",
          justifyContent: "center",
          opacity: cta,
          transform: `translateY(${(1 - cta) * 30}px) scale(${ctaPulse})`,
        }}
      >
        <div
          style={{
            background: `linear-gradient(180deg, ${B.teal500}, ${B.teal700})`,
            color: "#fff",
            fontFamily: sans,
            fontWeight: 900,
            fontSize: 40,
            letterSpacing: 0.5,
            padding: "26px 36px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 24px 50px -22px rgba(11,94,82,0.8)",
          }}
        >
          {p.end.cta}
        </div>
      </div>

      {/* termin */}
      <div
        style={{
          position: "absolute",
          left: CX - 400,
          width: 800,
          top: 1146,
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 30,
          lineHeight: 1.3,
          color: B.ink500,
          textWrap: "balance",
          opacity: small,
        }}
      >
        {p.end.small}
      </div>
    </AbsoluteFill>
  );
};
