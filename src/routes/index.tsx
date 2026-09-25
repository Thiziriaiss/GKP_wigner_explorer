import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";

import { ControlPanel } from "@/components/wigner/ControlPanel";
import { StabilizerPanel } from "@/components/wigner/StabilizerPanel";
import { Tex } from "@/components/wigner/Tex";

import { useGkpSimulation } from "@/hooks/useGkpSimulation";
import { FOCK_CUTOFF, PHASE_LIMIT, TIME_WINDOW } from "@/lib/quantum/protocol";
import { makeLattice } from "@/lib/quantum/state";
import type { GateKind, LatticeKind, LogicalState } from "@/lib/quantum/state";

const WignerScene = lazy(() => import("@/components/wigner/WignerScene"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "GKP Wigner Explorer — 3D Wigner function of a physical GKP qubit" },
      {
        name: "description",
        content:
          "Interactive 3D Wigner function of a finite-energy square-lattice GKP qubit: tune the squeezing parameter delta, apply logical bit and phase flips, and watch photon loss and dephasing act in real time.",
      },
      { property: "og:title", content: "GKP Wigner Explorer" },
      {
        property: "og:description",
        content:
          "Rotate the 3D Wigner function of a physical GKP qubit, tune squeezing, apply logical X and Z, and animate photon loss and dephasing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function PlotFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p className="font-mono text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Index() {
  const [cutoff, setCutoff] = useState(FOCK_CUTOFF);
  const [delta, setDelta] = useState(0.3);
  const [logical, setLogical] = useState<LogicalState>("0");
  const [gates, setGates] = useState<Array<GateKind>>([]);
  const [kappa1, setKappa1] = useState(0);
  const [kappaPhi, setKappaPhi] = useState(0);
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOW);
  const [playing, setPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [showStabilizers, setShowStabilizers] = useState(false);
  const [panelWidth, setPanelWidth] = useState(304);
  const [latticeKind, setLatticeKind] = useState<LatticeKind>("square");
  const [latticeRatio, setLatticeRatio] = useState(1);

  const sim = useGkpSimulation({
    cutoff,
    delta,
    logical,
    gates,
    kappa1,
    kappaPhi,
    timeWindow,
    latticeKind,
    latticeRatio,
  });
  const loadedFrames = sim.frames.filter(Boolean).length;

  useEffect(() => {
    setFrameIndex(0);
    setPlaying(kappa1 > 0 || kappaPhi > 0);
  }, [
    cutoff,
    delta,
    logical,
    gates,
    kappa1,
    kappaPhi,
    timeWindow,
    latticeKind,
    latticeRatio,
  ]);


  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setFrameIndex((i) => {
        const next = i + 1;
        if (next >= sim.frameCount) return 0;
        return sim.frames[next] ? next : i;
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [playing, sim.frameCount, sim.frames]);

  const activeIndex = Math.min(frameIndex, Math.max(0, sim.frames.length - 1));
  const frame = sim.frames[activeIndex] ?? sim.frames[0] ?? null;
  const reference = useMemo(() => {
    const first = sim.frames[0];
    if (!first) return 0.32;
    return Math.max(Math.abs(first.stats.min), Math.abs(first.stats.max), 1e-6);
  }, [sim.frames]);

  // Keep the last successfully rendered surface so the canvas (and therefore the
  // camera orientation the user set with the mouse) is never unmounted while a
  // new simulation is being computed.
  const lastScene = useRef<{
    coords: Float64Array;
    values: Float64Array;
    size: number;
    reference: number;
  } | null>(null);
  if (sim.coords && frame) {
    lastScene.current = {
      coords: sim.coords,
      values: frame.values,
      size: sim.size,
      reference,
    };
  }
  const scene = lastScene.current;

  return (
    <main className="flex min-h-screen flex-col bg-background md:h-screen md:flex-row md:overflow-hidden">
      <div className="relative h-[55vh] min-h-[320px] w-full md:h-screen md:min-h-0 md:w-0 md:min-w-0 md:flex-1 md:basis-0">
        <ClientOnly fallback={<PlotFallback label="preparing plot…" />}>
          <Suspense fallback={<PlotFallback label="loading renderer…" />}>
            {scene ? (
              <WignerScene
                coords={scene.coords}
                values={scene.values}
                size={scene.size}
                reference={scene.reference}
                limit={PHASE_LIMIT}
                lattice={makeLattice({ kind: latticeKind, ratio: latticeRatio })}
              />
            ) : (
              <PlotFallback label="building GKP state…" />
            )}
          </Suspense>
        </ClientOnly>

        {showStabilizers && (
          <StabilizerPanel
            stats={sim.frames.map((f) => f?.stats)}
            activeIndex={activeIndex}
            onClose={() => setShowStabilizers(false)}
          />
        )}
        <div className="pointer-events-none absolute bottom-3 left-4 text-[0.72rem] text-muted-foreground">
          <Tex>{String.raw`W(q,p)\;\cdot\; q,p \in [-${PHASE_LIMIT}, +${PHASE_LIMIT}]\;\cdot\; ${latticeKind === "rect" ? String.raw`\text{rectangular code lattice},\; r = ${latticeRatio.toFixed(2)}` : String.raw`\text{square code lattice}`}`}</Tex>
        </div>

      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize the control column"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const startX = e.clientX;
          const startW = panelWidth;
          const move = (ev: PointerEvent) => {
            const next = startW - (ev.clientX - startX);
            setPanelWidth(Math.min(680, Math.max(240, next)));
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
        className="hidden shrink-0 cursor-col-resize items-center justify-center bg-border/60 transition-colors hover:bg-primary/60 md:flex md:w-1.5"
      >
        <span className="h-8 w-[2px] rounded bg-muted-foreground/40" />
      </div>
      <ControlPanel
        width={panelWidth}
        latticeKind={latticeKind}
        onLatticeKind={setLatticeKind}
        latticeRatio={latticeRatio}
        onLatticeRatio={setLatticeRatio}
        delta={delta}
        onDelta={setDelta}
        cutoff={cutoff}
        onCutoff={setCutoff}
        logical={logical}
        onLogical={setLogical}
        gates={gates}
        onGate={(g) => setGates((prev) => [...prev, g])}
        onReset={() => setGates([])}

        kappa1={kappa1}
        onKappa1={setKappa1}
        kappaPhi={kappaPhi}
        onKappaPhi={setKappaPhi}
        timeWindow={timeWindow}
        onTimeWindow={setTimeWindow}
        playing={playing}
        onPlaying={setPlaying}
        frameIndex={activeIndex}
        onFrameIndex={setFrameIndex}
        frameCount={sim.frameCount}
        loadedFrames={loadedFrames}
        stats={frame?.stats ?? null}
        computing={sim.computing}
        showStabilizers={showStabilizers}
        onShowStabilizers={setShowStabilizers}
        truncationWarning={(frame?.stats.tailPopulation ?? 0) > 2e-3}
      />
    </main>
  );
}
