import { AbsoluteFill, useCurrentFrame } from "remotion";
import { RingCanvas } from "./Ring3D";

export const RingTest: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#F6F7F5" }}>
      <RingCanvas width={1080} height={1920} glow={0.3} pose={{ x: -0.1, y: 0, z: 0, rotX: Math.PI / 2 - 0.35, rotY: 0, rotZ: 0.3 + f * 0.04, scale: 0.6 }} />
    </AbsoluteFill>
  );
};
