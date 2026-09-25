import type { GateKind, LatticeSpec, LogicalState } from "./state";

export const FOCK_CUTOFF = 100;
export const FOCK_CUTOFF_MIN = 20;
export const FOCK_CUTOFF_MAX = 400;
export const GRID_SIZE = 81;
export const PHASE_LIMIT = 6;
export const TIME_WINDOW = 3;
export const TIME_WINDOW_MAX = 10;
export const FRAME_COUNT = 41;

export interface SimRequest {
  id: number;
  cutoff: number;
  delta: number;
  logical: LogicalState;
  gates: Array<GateKind>;
  kappa1: number;
  kappaPhi: number;
  timeWindow: number;
  lattice: LatticeSpec;
}


export interface FrameStats {
  time: number;
  min: number;
  max: number;
  purity: number;
  meanPhotons: number;
  tailPopulation: number;
  sq: number;
  sp: number;

}

export type SimMessage =
  | { type: "meta"; id: number; coords: Float64Array; frameCount: number; size: number }
  | { type: "frame"; id: number; index: number; values: Float64Array; stats: FrameStats }
  | { type: "done"; id: number };
