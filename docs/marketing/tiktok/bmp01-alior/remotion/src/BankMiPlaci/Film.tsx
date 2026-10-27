import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background, LightSweep } from "./Background";
import { Captions } from "./Captions";
import type { Promo } from "./promo";
import { ConditionsScene } from "./scenes/Conditions";
import { EligibilityScene } from "./scenes/Eligibility";
import { EndCardScene } from "./scenes/EndCard";
import { FormScene } from "./scenes/Form";
import { HookScene } from "./scenes/Hook";
import { PayoutScene } from "./scenes/Payout";
import type { SceneProps } from "./scenes/types";
import { SCENES, TRANSITION, type SceneId } from "./timeline";
import { ease, easeInOut, sans } from "./theme";

const ORDER: [SceneId, React.FC<SceneProps>][] = [
  ["hook", HookScene],
  ["payout", PayoutScene],
  ["conditions", ConditionsScene],
  ["form", FormScene],
  ["eligibility", EligibilityScene],
  ["end", EndCardScene],
];

// Wspólne przejście: nowa scena wjeżdża od dołu z rozmyciem, stara odpływa w przód i znika.
// Pierwsza scena nie ma wejścia — DO 800 ZŁ musi być czytelne od klatki 0.
const SceneShell: React.FC<{ id: SceneId; Comp: React.FC<SceneProps>; p: Promo; first: boolean; last: boolean }> = ({
  id,
  Comp,
  p,
  first,
  last,
}) => {
  const t = useCurrentFrame();
  const dur = SCENES[id].to - SCENES[id].from;
  const inP = first ? 1 : ease(t, [0, TRANSITION]);
  const outP = last ? 0 : easeInOut(t, [dur, dur + TRANSITION]);
  return (
    <AbsoluteFill
      style={{
        opacity: inP * (1 - outP),
        transform: `translateY(${(1 - inP) * 70}px) scale(${(0.97 + 0.03 * inP) * (1 + 0.05 * outP)})`,
        filter: inP < 1 || outP > 0 ? `blur(${(1 - inP) * 10 + outP * 12}px)` : undefined,
      }}
    >
      <Comp t={t} dur={dur} p={p} />
    </AbsoluteFill>
  );
};

export const BankMiPlaciFilm: React.FC<Promo & { withAudio?: boolean }> = ({ withAudio = true, ...p }) => {
  const f = useCurrentFrame();
  // błysk światła i lekki puls tła na każdej zmianie sceny
  const cut = ORDER.slice(1)
    .map(([id]) => SCENES[id].from)
    .map((c) => (f >= c - 4 && f <= c + 16 ? (f - (c - 4)) / 20 : -1))
    .find((x) => x >= 0);
  return (
    <AbsoluteFill style={{ fontFamily: sans }}>
      {withAudio && <Audio src={staticFile("bmp01/mix.wav")} />}
      <Background f={f} pulse={cut !== undefined ? Math.sin(cut * Math.PI) : 0} />
      {ORDER.map(([id, Comp], i) => {
        const s = SCENES[id];
        const last = i === ORDER.length - 1;
        return (
          <Sequence key={id} from={s.from} durationInFrames={s.to - s.from + (last ? 0 : TRANSITION)} layout="none">
            <SceneShell id={id} Comp={Comp} p={p as Promo} first={i === 0} last={last} />
          </Sequence>
        );
      })}
      <LightSweep p={cut ?? -1} />
      <Captions f={f} />
    </AbsoluteFill>
  );
};
