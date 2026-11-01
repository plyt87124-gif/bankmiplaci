import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { END } from "./data";
import { BanksScene, CalendarScene, CatchScene, EndScene, HookScene, type SceneProps } from "./scenes";
import { body, ease, easeInOut } from "./theme";
import { SCENES, TRANSITION, type SceneId } from "./timeline";
import { AdTag, Background, Captions } from "./ui";

const ORDER: [SceneId, React.FC<SceneProps>][] = [
  ["hook", HookScene],
  ["banks", BanksScene],
  ["calendar", CalendarScene],
  ["catch", CatchScene],
  ["end", EndScene],
];

const Shell: React.FC<{ id: SceneId; Comp: React.FC<SceneProps>; first: boolean; last: boolean }> = ({ id, Comp, first, last }) => {
  const t = useCurrentFrame();
  const dur = SCENES[id].to - SCENES[id].from;
  const inP = first ? 1 : ease(t, [0, TRANSITION]);
  const outP = last ? 0 : easeInOut(t, [dur, dur + TRANSITION]);
  return (
    <AbsoluteFill
      style={{
        opacity: inP * (1 - outP),
        transform: `translateY(${(1 - inP) * 60}px) scale(${(0.97 + 0.03 * inP) * (1 + 0.04 * outP)})`,
        filter: inP < 1 || outP > 0 ? `blur(${(1 - inP) * 10 + outP * 10}px)` : undefined,
      }}
    >
      <Comp t={t} dur={dur} />
    </AbsoluteFill>
  );
};

export const BMP02Film: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: body }}>
      {withAudio && <Audio src={staticFile("bmp02/mix.wav")} />}
      <Background f={f} />
      {ORDER.map(([id, Comp], i) => {
        const s = SCENES[id];
        const last = i === ORDER.length - 1;
        return (
          <Sequence key={id} from={s.from} durationInFrames={s.to - s.from + (last ? 0 : TRANSITION)} layout="none">
            <Shell id={id} Comp={Comp} first={i === 0} last={last} />
          </Sequence>
        );
      })}
      <AdTag text={END.adTag} />
      <Captions f={f} />
    </AbsoluteFill>
  );
};
