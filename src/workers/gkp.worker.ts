/// <reference lib="webworker" />

import { evolve } from "@/lib/quantum/lindblad";
import {
  FOCK_CUTOFF,
  FOCK_CUTOFF_MAX,
  FOCK_CUTOFF_MIN,
  FRAME_COUNT,
  GRID_SIZE,
  PHASE_LIMIT,
  TIME_WINDOW,
  type SimMessage,
  type SimRequest,
} from "@/lib/quantum/protocol";
import {
  densityFromVector,
  diagnostics,
  gkpState,
  logicalX,
  logicalZ,
  stabilizerSpOp,
  stabilizerSqOp,
  stabilizerStats,
  type CVector,
} from "@/lib/quantum/state";
import { hermiteBasis, makeAxes, wignerGrid } from "@/lib/quantum/wigner";

const axes = makeAxes(PHASE_LIMIT, GRID_SIZE, 0.05);

let cached: { n: number; basis: Float64Array } | null = null;
const basisFor = (n: number): Float64Array => {
  if (!cached || cached.n !== n) cached = { n, basis: hermiteBasis(axes.fine, n) };
  return cached.basis;
};

let currentId = 0;

const post = (msg: SimMessage, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer);

self.onmessage = (event: MessageEvent<SimRequest>) => {
  const req = event.data;
  currentId = req.id;

  const cutoff = Math.round(
    Math.min(FOCK_CUTOFF_MAX, Math.max(FOCK_CUTOFF_MIN, req.cutoff || FOCK_CUTOFF)),
  );
  const basis = basisFor(cutoff);

  const lattice = req.lattice;
  let psi: CVector = gkpState(cutoff, req.delta, req.logical, lattice);
  const gateDelta = req.delta;
  for (const gate of req.gates) {
    if (gate === "X") psi = logicalX(psi, gateDelta, lattice);
    else if (gate === "Z") psi = logicalZ(psi, gateDelta, lattice);
    else if (gate === "Sq") psi = stabilizerSqOp(psi, gateDelta, lattice);
    else psi = stabilizerSpOp(psi, gateDelta, lattice);
  }


  const dissipative = req.kappa1 > 0 || req.kappaPhi > 0;
  const frameCount = dissipative ? FRAME_COUNT : 1;
  const window = Math.min(10, Math.max(0.1, req.timeWindow || TIME_WINDOW));
  const dtFrame = window / (FRAME_COUNT - 1);
  const stepsPerFrame = Math.max(1, Math.ceil(dtFrame / 0.005));
  const dt = dtFrame / stepsPerFrame;

  post({
    type: "meta",
    id: req.id,
    coords: new Float64Array(axes.coords),
    frameCount,
    size: GRID_SIZE,
  });

  const rho = densityFromVector(psi);

  for (let f = 0; f < frameCount; f++) {
    if (currentId !== req.id) return;
    if (f > 0) evolve(rho, req.kappa1, req.kappaPhi, dt, stepsPerFrame);
    const grid = wignerGrid(rho, axes, basis);
    const diag = diagnostics(rho);
    const stab = stabilizerStats(rho, req.delta, lattice);
    post(
      {
        type: "frame",
        id: req.id,
        index: f,
        values: grid.values,
        stats: {
          time: f * dtFrame,
          min: grid.min,
          max: grid.max,
          purity: diag.purity,
          meanPhotons: diag.meanPhotons,
          tailPopulation: diag.tailPopulation,
          sq: stab.sq,
          sp: stab.sp,
        },
      },
      [grid.values.buffer],
    );
  }

  post({ type: "done", id: req.id });
};
