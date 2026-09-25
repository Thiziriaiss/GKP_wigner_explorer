import { useEffect, useMemo, useRef, useState } from "react";

import type { FrameStats, SimMessage, SimRequest } from "@/lib/quantum/protocol";
import type { GateKind, LatticeKind, LogicalState } from "@/lib/quantum/state";

export interface SimFrame {
  values: Float64Array;
  stats: FrameStats;
}

export interface SimParams {
  cutoff: number;
  delta: number;
  logical: LogicalState;
  gates: Array<GateKind>;
  kappa1: number;
  kappaPhi: number;
  timeWindow: number;
  latticeKind: LatticeKind;
  latticeRatio: number;
}


export interface SimResult {
  coords: Float64Array | null;
  size: number;
  frames: SimFrame[];
  frameCount: number;
  computing: boolean;
}

export function useGkpSimulation(params: SimParams): SimResult {
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const [result, setResult] = useState<SimResult>({
    coords: null,
    size: 0,
    frames: [],
    frameCount: 1,
    computing: true,
  });

  useEffect(() => {
    const worker = new Worker(new URL("../workers/gkp.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<SimMessage>) => {
      const msg = event.data;
      if (msg.id !== requestId.current) return;
      if (msg.type === "meta") {
        setResult({
          coords: msg.coords,
          size: msg.size,
          frames: [],
          frameCount: msg.frameCount,
          computing: true,
        });
      } else if (msg.type === "frame") {
        setResult((prev) => {
          const frames = prev.frames.slice();
          frames[msg.index] = { values: msg.values, stats: msg.stats };
          return { ...prev, frames };
        });
      } else {
        setResult((prev) => ({ ...prev, computing: false }));
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const gateKey = params.gates.join(",");

  const request = useMemo<SimRequest>(
    () => ({
      id: 0,
      cutoff: params.cutoff,
      delta: params.delta,
      logical: params.logical,
      gates: (gateKey ? gateKey.split(",") : []) as SimRequest["gates"],
      kappa1: params.kappa1,
      kappaPhi: params.kappaPhi,
      timeWindow: params.timeWindow,
      lattice: { kind: params.latticeKind, ratio: params.latticeRatio },
    }),
    [
      params.cutoff,
      params.delta,
      params.logical,
      gateKey,
      params.kappa1,
      params.kappaPhi,
      params.timeWindow,
      params.latticeKind,
      params.latticeRatio,
    ],
  );


  useEffect(() => {
    const timer = window.setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) return;
      requestId.current += 1;
      setResult((prev) => ({ ...prev, computing: true }));
      worker.postMessage({ ...request, id: requestId.current });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [request]);

  return result;
}
