import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowDownToLine, Box, MoveHorizontal, MoveVertical } from "lucide-react";
import * as THREE from "three";


import { SQUARE_LATTICE } from "@/lib/quantum/state";
import type { Lattice } from "@/lib/quantum/state";

import { divergingColor } from "./colormap";
import { Tex } from "./Tex";

import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Html,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  OrbitControls,
  SceneColor,
} from "./three-elements";

const SQRT_PI = Math.sqrt(Math.PI);
/** Absolute bound on the Wigner function of any state: |W| <= 1/pi. */
const W_BOUND = 1 / Math.PI;

/** Subdivisions inserted between neighbouring real samples when rendering. */
const SUBDIV = 3;

const clampIdx = (i: number, n: number) => (i < 0 ? 0 : i > n - 1 ? n - 1 : i);

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Bicubic (Catmull-Rom) resample of the real `size x size` Wigner samples onto
 * a denser display lattice. No new physics: the smooth curve implied by the
 * computed samples.
 */
function resample(values: Float64Array, size: number, dSize: number): Float64Array {
  const out = new Float64Array(dSize * dSize);
  const at = (i: number, j: number) =>
    values[clampIdx(i, size) * size + clampIdx(j, size)] ?? 0;

  // Interpolate along j first into a size x dSize buffer, then along i.
  const rows = new Float64Array(size * dSize);
  for (let i = 0; i < size; i++) {
    for (let dj = 0; dj < dSize; dj++) {
      const g = dj / SUBDIV;
      const j = Math.min(size - 2, Math.floor(g));
      const t = g - j;
      rows[i * dSize + dj] = catmullRom(at(i, j - 1), at(i, j), at(i, j + 1), at(i, j + 2), t);
    }
  }
  const row = (i: number, dj: number) => rows[clampIdx(i, size) * dSize + dj] ?? 0;
  for (let di = 0; di < dSize; di++) {
    const g = di / SUBDIV;
    const i = Math.min(size - 2, Math.floor(g));
    const t = g - i;
    for (let dj = 0; dj < dSize; dj++) {
      out[di * dSize + dj] = catmullRom(
        row(i - 1, dj),
        row(i, dj),
        row(i + 1, dj),
        row(i + 2, dj),
        t,
      );
    }
  }
  return out;
}

interface SurfaceProps {
  coords: Float64Array;
  values: Float64Array;
  size: number;
  reference: number;
  heightScale: number;
  showSamples: boolean;
}

function WignerSurface({
  coords,
  values,
  size,
  reference,
  heightScale,
  showSamples,
}: SurfaceProps) {
  const dSize = (size - 1) * SUBDIV + 1;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = dSize * dSize;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const indices: number[] = [];
    for (let i = 0; i < dSize - 1; i++) {
      for (let j = 0; j < dSize - 1; j++) {
        const a = i * dSize + j;
        const b = a + 1;
        const c = a + dSize;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    geo.setIndex(indices);
    return geo;
  }, [dSize]);

  const coarse = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = size * size;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const indices: number[] = [];
    for (let i = 0; i < size - 1; i++) {
      for (let j = 0; j < size - 1; j++) {
        const a = i * size + j;
        indices.push(a, a + 1, a, a + size);
      }
    }
    geo.setIndex(indices);
    return geo;
  }, [size]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => coarse.dispose(), [coarse]);

  useEffect(() => {
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = geometry.getAttribute("color") as THREE.BufferAttribute;
    const scale = heightScale / (reference || 1);
    const dense = resample(values, size, dSize);
    const c0 = coords[0] ?? 0;
    const step = ((coords[size - 1] ?? 0) - c0) / ((size - 1) * SUBDIV);
    for (let i = 0; i < dSize; i++) {
      const x = c0 + i * step;
      for (let j = 0; j < dSize; j++) {
        const idx = i * dSize + j;
        const w = dense[idx] ?? 0;
        pos.setXYZ(idx, x, w * scale, -(c0 + j * step));
        const [r, g, b] = divergingColor(w / W_BOUND);
        col.setXYZ(idx, r, g, b);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }, [coords, values, size, dSize, reference, heightScale, geometry]);

  useEffect(() => {
    if (!showSamples) return;
    const pos = coarse.getAttribute("position") as THREE.BufferAttribute;
    const scale = heightScale / (reference || 1);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const idx = i * size + j;
        const w = values[idx] ?? 0;
        pos.setXYZ(idx, coords[i] ?? 0, w * scale, -(coords[j] ?? 0));
      }
    }
    pos.needsUpdate = true;
    coarse.computeBoundingSphere();
  }, [coords, values, size, reference, heightScale, coarse, showSamples]);

  return (
    <Group>
      <Mesh geometry={geometry}>
        <MeshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.55}
          metalness={0.05}
          flatShading={false}
        />
      </Mesh>
      {showSamples && (
        <LineSegments geometry={coarse}>
          <LineBasicMaterial color="#2c3340" transparent opacity={0.12} />
        </LineSegments>
      )}
    </Group>
  );
}

function LatticeFloor({ limit, lattice }: { limit: number; lattice: Lattice }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    // Half lattice vectors: these mark the logical (X, Z) positions.
    const h1: [number, number] = [lattice.l1[0] / 2, lattice.l1[1] / 2];
    const h2: [number, number] = [lattice.l2[0] / 2, lattice.l2[1] / 2];
    const L = limit * 1.5;
    const family = (dir: [number, number], off: [number, number]) => {
      const len = Math.hypot(dir[0], dir[1]) || 1;
      const ux = dir[0] / len;
      const uy = dir[1] / len;
      const offLen = Math.hypot(off[0], off[1]) || 1;
      const n = Math.ceil(limit / offLen) + 1;
      for (let k = -n; k <= n; k++) {
        const ox = k * off[0];
        const oy = k * off[1];
        pts.push(ox - ux * L, 0, -(oy - uy * L), ox + ux * L, 0, -(oy + uy * L));
      }
    };
    family(h1, h2);
    family(h2, h1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [limit, lattice]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <LineSegments geometry={geometry}>
      <LineBasicMaterial color="#94a0b4" transparent opacity={0.45} />
    </LineSegments>
  );
}

function Axes({ limit, height }: { limit: number; height: number }) {
  const geometry = useMemo(() => {
    const pts = [
      -limit - 0.6,
      0,
      0,
      limit + 0.6,
      0,
      0,
      0,
      0,
      -limit - 0.6,
      0,
      0,
      limit + 0.6,
      0,
      0,
      0,
      0,
      height,
      0,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [limit, height]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <LineSegments geometry={geometry}>
      <LineBasicMaterial color="#3d4757" />
    </LineSegments>
  );
}

function AxisLabel({
  position,
  tex,
}: {
  position: [number, number, number];
  tex: string;
}) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }}>
      <Tex className="text-[0.9rem] whitespace-nowrap text-foreground select-none">{tex}</Tex>
    </Html>
  );
}

function AxisTick({ position, label }: { position: [number, number, number]; label: string }) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }}>
      <Tex className="text-[0.62rem] text-muted-foreground select-none">{label}</Tex>
    </Html>
  );
}

function ColorBar() {
  const gradient = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = 1 - (i / 20) * 2;
      const [r, g, b] = divergingColor(t);
      const to255 = (v: number) => Math.round(v * 255);
      stops.push(`rgb(${to255(r)}, ${to255(g)}, ${to255(b)}) ${(i / 20) * 100}%`);
    }
    return `linear-gradient(to bottom, ${stops.join(", ")})`;
  }, []);

  return (
    <div className="pointer-events-none absolute top-4 right-4 flex flex-col items-center gap-1">
      <div className="text-[0.7rem] text-foreground">
        <Tex>{String.raw`W(q,p)`}</Tex>
      </div>
      <div className="flex items-stretch gap-1">


        <div
          className="h-32 w-3 rounded-sm border border-border"
          style={{ backgroundImage: gradient }}
        />
        <div className="flex flex-col justify-between text-[0.62rem] text-muted-foreground">
          <Tex>{String.raw`+\tfrac{1}{\pi}`}</Tex>
          <Tex>{String.raw`0`}</Tex>
          <Tex>{String.raw`-\tfrac{1}{\pi}`}</Tex>
        </div>
      </div>
    </div>
  );
}


/** Preset camera placements, in the order shown by the overlay buttons. */
const VIEWS = {
  top: { position: [0, 24, 0.001] as const, Icon: ArrowDownToLine, title: "view from above" },
  q: { position: [20, 3.5, 0] as const, Icon: MoveHorizontal, title: "view along the q axis" },
  p: { position: [0, 3.5, -20] as const, Icon: MoveVertical, title: "view along the p axis" },
  iso: { position: [12.5, 10.5, 16] as const, Icon: Box, title: "default 3D view" },
};


type ViewKey = keyof typeof VIEWS;

/** Moves the camera to a preset whenever `request` changes. */
function ViewSetter({
  request,
  controls,
}: {
  request: { key: ViewKey; n: number } | null;
  controls: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>;
}) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!request) return;
    const [x, y, z] = VIEWS[request.key].position;
    camera.position.set(x, y, z);
    camera.up.set(0, 1, 0);
    const c = controls.current;
    if (c) {
      c.target.set(0, 0.5, 0);
      c.update();
    }
    camera.lookAt(0, 0.5, 0);
  }, [request, camera, controls]);
  return null;
}


export interface WignerSceneProps {

  coords: Float64Array;
  values: Float64Array;
  size: number;
  reference: number;
  limit: number;
  lattice?: Lattice;
  showSamples?: boolean;
}

/**
 * Ticks at multiples of the lattice half-period. Labels are plain numbers in
 * units of sqrt(pi); the axis label itself carries the /sqrt(pi). When the
 * lattice is rectangular the labels are written as multiples of r (or of 1/r).
 */
function makeTicks(spacing: number, limit: number, unit?: "r" | "invr") {
  const out: Array<{ k: number; v: number; tex: string }> = [];
  if (!(spacing > 0)) return out;
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    const v = k * spacing;
    if (Math.abs(v) >= limit) continue;
    let tex: string;
    if (unit === "r") {
      tex = k === 1 ? "r" : k === -1 ? "-r" : `${k}r`;
    } else if (unit === "invr") {
      tex = String.raw`${k === 1 ? "" : k === -1 ? "-" : String(k)}\tfrac{1}{r}`;
    } else {
      const c = v / SQRT_PI;
      const near = Math.round(c);
      tex = Math.abs(c - near) < 1e-3 ? String(near) : c.toFixed(2);
    }
    out.push({ k, v, tex });
  }
  return out;
}

export default function WignerScene({
  coords,
  values,
  size,
  reference,
  limit,
  lattice = SQUARE_LATTICE,
  showSamples = false,
}: WignerSceneProps) {
  const controls = useRef(null);
  const [view, setView] = useState<{ key: ViewKey; n: number } | null>(null);
  const goTo = (key: ViewKey) => setView((v) => ({ key, n: (v?.n ?? 0) + 1 }));

  const rect = Math.abs(Math.abs(lattice.l1[0]) - Math.abs(lattice.l2[1])) > 1e-9;
  const qTicks = makeTicks(Math.abs(lattice.l1[0]) / 2, limit, rect ? "r" : undefined);
  const pTicks = makeTicks(Math.abs(lattice.l2[1]) / 2, limit, rect ? "invr" : undefined);

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [12.5, 10.5, 16], fov: 40 }} dpr={[1, 2]}>
      <SceneColor attach="background" args={["#fbfbfa"]} />
      <AmbientLight intensity={0.85} />
      <HemisphereLight args={["#ffffff", "#dfe4ec", 0.7]} />
      <DirectionalLight position={[9, 14, 7]} intensity={1.1} />
      <DirectionalLight position={[-8, 6, -9]} intensity={0.35} />
      <WignerSurface
        coords={coords}
        values={values}
        size={size}
        reference={reference}
        heightScale={3}
        showSamples={showSamples}
      />
        <LatticeFloor limit={limit} lattice={lattice} />
        <Axes limit={limit} height={3.4} />
        <AxisLabel position={[limit + 1.3, 0, 0]} tex={String.raw`q/\sqrt{\pi}`} />
        <AxisLabel position={[0, 0, -(limit + 1.3)]} tex={String.raw`p/\sqrt{\pi}`} />

        {qTicks.map((t) => (
          <AxisTick key={`q${t.k}`} position={[t.v, -0.35, 0]} label={t.tex} />
        ))}
        {pTicks.map((t) => (
          <AxisTick key={`p${t.k}`} position={[0, -0.35, -t.v]} label={t.tex} />
        ))}
        <OrbitControls
          ref={controls}
          enablePan={false}
          target={[0, 0.5, 0]}
          minDistance={8}
          maxDistance={34}
          maxPolarAngle={Math.PI * 0.96}
          dampingFactor={0.12}
        />
        <ViewSetter request={view} controls={controls} />
      </Canvas>
      <ColorBar />
      <div className="absolute top-4 left-4 flex flex-col gap-1">
        {(["top", "q", "p", "iso"] as Array<ViewKey>).map((k) => {
          const { Icon, title } = VIEWS[k];
          return (
            <button
              key={k}
              onClick={() => goTo(k)}
              title={title}
              aria-label={title}
              className="rounded border border-border bg-background/85 p-1 text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
            </button>
          );
        })}
      </div>

    </div>
  );

}
