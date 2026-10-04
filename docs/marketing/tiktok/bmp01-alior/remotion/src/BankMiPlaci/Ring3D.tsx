import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Stylizowana obrączka płatnicza (ilustracja, nie wierne odwzorowanie produktu).
// Profil "comfort fit": zaokrąglony prostokąt obracany wokół osi Y (LatheGeometry), więc
// obrączka leży w płaszczyźnie XZ — rotX ≈ π/2 stawia ją "na sztorc" przodem do kamery.
const ringGeometry = (inner = 1, thick = 0.16, width = 0.62) => {
  const pts: THREE.Vector2[] = [];
  const r = 0.07;
  const x0 = inner;
  const x1 = inner + thick;
  const y0 = -width / 2;
  const y1 = width / 2;
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + ((a1 - a0) * i) / 8;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
  arc(x1 - r, y0 + r, -Math.PI / 2, 0);
  arc(x1 - r, y1 - r, 0, Math.PI / 2);
  arc(x0 + r, y1 - r, Math.PI / 2, Math.PI);
  pts.push(pts[0].clone());
  const g = new THREE.LatheGeometry(pts, 192);
  g.computeVertexNormals();
  return g;
};

export const RING_OUTER = 1.16; // promień zewnętrzny w jednostkach sceny (przy scale = 1)

// Oświetlenie otoczenia liczone synchronicznie w renderze (nie w useEffect) — inaczej
// Remotion zrobi zrzut klatki, zanim metal dostanie odbicia, i obrączka wyjdzie czarna.
const Environment: React.FC = () => {
  const gl = useThree((s) => s.gl);
  const tex = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const t = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    pmrem.dispose();
    return t;
  }, [gl]);
  return <primitive object={tex} attach="environment" />;
};

export type RingPose = {
  x: number; // jednostki sceny; przy domyślnej kamerze 1 jednostka ≈ 398 px
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
};

export const RingMesh: React.FC<{ pose: RingPose; glow?: number }> = ({ pose, glow = 0 }) => {
  const geo = useMemo(() => ringGeometry(), []);
  return (
    <group position={[pose.x, pose.y, pose.z]} rotation={[pose.rotX, pose.rotY, pose.rotZ]} scale={pose.scale}>
      <mesh geometry={geo}>
        {/* grafitowa ceramika z połyskiem */}
        <meshPhysicalMaterial color="#1E242B" metalness={0.55} roughness={0.18} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={1.25} />
      </mesh>
      {/* cienki pasek w kolorze marki na obwodzie */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RING_OUTER + 0.004, 0.014, 16, 256]} />
        <meshStandardMaterial color="#159683" emissive="#159683" emissiveIntensity={0.25 + glow * 1.4} metalness={0.3} roughness={0.25} />
      </mesh>
    </group>
  );
};

/** Pełnoekranowe płótno 3D z przezroczystym tłem. 1 jednostka sceny ≈ 398 px przy z = 0. */
export const RingCanvas: React.FC<{
  width: number;
  height: number;
  pose: RingPose;
  glow?: number;
  style?: React.CSSProperties;
}> = ({ width, height, pose, glow, style }) => (
  <ThreeCanvas
    width={width}
    height={height}
    gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
    onCreated={({ gl }) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.05;
      gl.outputColorSpace = THREE.SRGBColorSpace;
    }}
    camera={{ fov: 30, position: [0, 0, 9], near: 0.1, far: 100 }}
    style={{ position: "absolute", left: 0, top: 0, ...style }}
  >
    <Environment />
    <ambientLight intensity={0.35} />
    <directionalLight position={[3, 5, 6]} intensity={2.2} />
    <directionalLight position={[-5, -1, 2]} intensity={0.9} color="#CFEDE6" />
    <RingMesh pose={pose} glow={glow} />
  </ThreeCanvas>
);

/** px ↔ jednostki sceny dla domyślnej kamery (fov 30°, z = 9, wysokość płótna 1920 px) */
export const PX_PER_UNIT = 1920 / (2 * 9 * Math.tan((15 * Math.PI) / 180));
export const pxToUnits = (px: number) => px / PX_PER_UNIT;
