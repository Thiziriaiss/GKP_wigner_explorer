// @ts-nocheck -- numeric kernel: typed-array indexing under noUncheckedIndexedAccess
/**
 * Finite-energy (physical) square-lattice GKP states in a truncated Fock basis.
 *
 * Conventions (hbar = 1):
 *   x = (a + a†)/sqrt(2),  p = i(a† - a)/sqrt(2)
 *   D(alpha) with alpha = (x0 + i p0)/sqrt(2) shifts x by x0 and p by p0.
 *   Stabilizers are displacements by 2*sqrt(pi); logical X shifts x by
 *   sqrt(pi), logical Z shifts p by sqrt(pi).
 */

export const SQRT_PI = Math.sqrt(Math.PI);

export interface CVector {
  re: Float64Array;
  im: Float64Array;
}

export function zeroVector(n: number): CVector {
  return { re: new Float64Array(n), im: new Float64Array(n) };
}

export function copyVector(v: CVector): CVector {
  return { re: new Float64Array(v.re), im: new Float64Array(v.im) };
}

export function vectorNorm(v: CVector): number {
  let s = 0;
  for (let i = 0; i < v.re.length; i++) s += v.re[i] * v.re[i] + v.im[i] * v.im[i];
  return Math.sqrt(s);
}

export function normalizeVector(v: CVector): CVector {
  const n = vectorNorm(v);
  if (n === 0) return v;
  for (let i = 0; i < v.re.length; i++) {
    v.re[i] /= n;
    v.im[i] /= n;
  }
  return v;
}

export function addScaled(target: CVector, source: CVector, cRe: number, cIm: number) {
  for (let i = 0; i < target.re.length; i++) {
    target.re[i] += cRe * source.re[i] - cIm * source.im[i];
    target.im[i] += cRe * source.im[i] + cIm * source.re[i];
  }
}

/**
 * Squeezed vacuum S(r)|0> with <x^2> = e^{-2r}/2, i.e. r = -ln(delta) gives
 * peaks of width delta in x.
 */
export function squeezedVacuum(n: number, r: number): CVector {
  const v = zeroVector(n);
  const t = -Math.tanh(r);
  v.re[0] = 1 / Math.sqrt(Math.cosh(r));
  for (let k = 1; 2 * k < n; k++) {
    v.re[2 * k] = v.re[2 * k - 2] * t * Math.sqrt((2 * k - 1) / (2 * k));
  }
  return v;
}

/** (M v)_n where M = alpha a† - conj(alpha) a. */
function applyGenerator(v: CVector, aRe: number, aIm: number): CVector {
  const n = v.re.length;
  const out = zeroVector(n);
  for (let k = 0; k < n; k++) {
    // alpha * sqrt(k) * v[k-1]
    if (k > 0) {
      const s = Math.sqrt(k);
      out.re[k] += s * (aRe * v.re[k - 1] - aIm * v.im[k - 1]);
      out.im[k] += s * (aRe * v.im[k - 1] + aIm * v.re[k - 1]);
    }
    // -conj(alpha) * sqrt(k+1) * v[k+1]
    if (k + 1 < n) {
      const s = Math.sqrt(k + 1);
      out.re[k] -= s * (aRe * v.re[k + 1] + aIm * v.im[k + 1]);
      out.im[k] -= s * (aRe * v.im[k + 1] - aIm * v.re[k + 1]);
    }
  }
  return out;
}

/**
 * Apply the displacement operator D(alpha) = exp(alpha a† - conj(alpha) a) to a
 * state vector using scaling + Taylor series on the (sparse) generator action.
 */
export function displace(v: CVector, alphaRe: number, alphaIm: number): CVector {
  const mag = Math.hypot(alphaRe, alphaIm);
  if (mag === 0) return copyVector(v);
  const steps = Math.max(1, Math.ceil(6 * mag));
  const aRe = alphaRe / steps;
  const aIm = alphaIm / steps;
  let cur = copyVector(v);
  for (let s = 0; s < steps; s++) {
    const acc = copyVector(cur);
    let term = cur;
    for (let k = 1; k <= 24; k++) {
      term = applyGenerator(term, aRe, aIm);
      const inv = 1 / factorialRatio(k);
      let maxAbs = 0;
      for (let i = 0; i < acc.re.length; i++) {
        const tr = term.re[i] * inv;
        const ti = term.im[i] * inv;
        acc.re[i] += tr;
        acc.im[i] += ti;
        const m = Math.abs(tr) + Math.abs(ti);
        if (m > maxAbs) maxAbs = m;
      }
      if (maxAbs < 1e-16) break;
    }
    cur = acc;
  }
  return cur;
}

const factCache: number[] = [1];
function factorialRatio(k: number): number {
  for (let i = factCache.length; i <= k; i++) factCache[i] = factCache[i - 1] * i;
  return factCache[k];
}

export type LogicalState = "0" | "1" | "+" | "-";

/** Operations the user can apply to the state. */
export type GateKind = "X" | "Z" | "Sq" | "Sp";

export type LatticeKind = "square" | "rect";

export interface LatticeSpec {
  kind: LatticeKind;
  /** Aspect ratio for the rectangular lattice (ignored otherwise). */
  ratio: number;
}

/**
 * Primitive stabilizer displacement vectors in phase space (q, p).
 * The unit cell area is always 4*pi, i.e. one encoded qubit.
 */
export interface Lattice {
  l1: [number, number];
  l2: [number, number];
  /** Whether the second generator has a q component (hex), needing 2D peak rows. */
  rows: boolean;
}

export const SQUARE_LATTICE: Lattice = {
  l1: [2 * SQRT_PI, 0],
  l2: [0, 2 * SQRT_PI],
  rows: false,
};

export function makeLattice(spec?: LatticeSpec): Lattice {
  if (!spec || spec.kind === "square") return SQUARE_LATTICE;
  if (spec.kind === "rect") {
    const r = Math.min(2, Math.max(0.5, spec.ratio || 1));
    return { l1: [2 * SQRT_PI * r, 0], l2: [0, (2 * SQRT_PI) / r], rows: false };
  }
  const a = Math.sqrt((8 * Math.PI) / Math.sqrt(3));
  return { l1: [a, 0], l2: [a / 2, (a * Math.sqrt(3)) / 2], rows: true };
}

const toAlpha = (q: number, p: number): [number, number] => [q / Math.SQRT2, p / Math.SQRT2];

/**
 * Finite-energy GKP code word: a comb of squeezed peaks under a Gaussian
 * envelope of width 1/delta, sitting on the chosen code lattice.
 */
function combState(n: number, delta: number, odd: boolean, lattice: Lattice): CVector {
  const r = -Math.log(delta);
  const sq = squeezedVacuum(n, r);
  const out = zeroVector(n);
  const [l1q, l1p] = lattice.l1;
  const [l2q, l2p] = lattice.l2;
  const span = Math.hypot(l1q, l1p) || 1;
  const mMax = Math.ceil(6 / (delta * span)) + 2;
  const nMax = lattice.rows ? Math.ceil(6 / (delta * (Math.hypot(l2q, l2p) || 1))) + 1 : 0;
  // A displaced-squeezed comb term needs roughly |alpha|^2 + sinh^2(r) photons
  // to be represented faithfully. Past that budget, `displace` aliases against
  // the Fock truncation boundary instead of just decaying, injecting a spurious
  // (non-physical) residual rather than a small, honestly-negligible one — so
  // such terms must be skipped outright, not just left to the amplitude cutoff
  // below (which only tracks physical weight, not Fock-space representability,
  // and can admit different numbers of terms for even vs. odd combs).
  const photonBudget = Math.max(0, 0.5 * n - Math.sinh(r) ** 2);
  for (let m = -mMax; m <= mMax; m++) {
    const shift = odd ? m + 0.5 : m;
    for (let k = -nMax; k <= nMax; k++) {
      const q = shift * l1q + k * l2q;
      const p = shift * l1p + k * l2p;
      const w = Math.exp(-0.5 * delta * delta * (q * q + p * p));
      if (w < 1e-8) continue;
      const [ar, ai] = toAlpha(q, p);
      if (ar * ar + ai * ai > photonBudget) continue;
      addScaled(out, displace(sq, ar, ai), w, 0);
    }
  }
  return normalizeVector(out);
}

export function gkpState(
  n: number,
  delta: number,
  logical: LogicalState,
  spec?: LatticeSpec,
): CVector {
  const lattice = makeLattice(spec);
  if (logical === "0") return combState(n, delta, false, lattice);
  if (logical === "1") return combState(n, delta, true, lattice);
  const zero = combState(n, delta, false, lattice);
  const one = combState(n, delta, true, lattice);
  const out = zeroVector(n);
  addScaled(out, zero, 1, 0);
  addScaled(out, one, logical === "+" ? 1 : -1, 0);
  return normalizeVector(out);
}

/**
 * Envelope-deformed displacement E_D D(alpha) E_D^{-1} with E_D = exp(-delta^2 n).
 * Non-unitary, so the result is renormalized.
 */
export function deformedDisplace(
  v: CVector,
  alphaRe: number,
  alphaIm: number,
  delta: number,
): CVector {
  const n = v.re.length;
  const d2 = delta * delta;
  const up = zeroVector(n);
  for (let k = 0; k < n; k++) {
    const w = Math.exp(d2 * k);
    if (!Number.isFinite(w)) break;
    up.re[k] = v.re[k] * w;
    up.im[k] = v.im[k] * w;
  }
  normalizeVector(up);
  const shifted = displace(up, alphaRe, alphaIm);
  for (let k = 0; k < n; k++) {
    const w = Math.exp(-d2 * k);
    shifted.re[k] *= w;
    shifted.im[k] *= w;
  }
  return normalizeVector(shifted);
}

function applyDisplacement(
  v: CVector,
  q: number,
  p: number,
  delta: number | undefined,
): CVector {
  const [ar, ai] = toAlpha(q, p);
  if (delta && delta > 0) return deformedDisplace(v, ar, ai, delta);
  return normalizeVector(displace(v, ar, ai));
}

/** Logical bit flip: half a lattice vector along the first generator. */
export function logicalX(v: CVector, delta?: number, spec?: LatticeSpec): CVector {
  const { l1 } = makeLattice(spec);
  return applyDisplacement(v, l1[0] / 2, l1[1] / 2, delta);
}

/** Logical phase flip: half a lattice vector along the second generator. */
export function logicalZ(v: CVector, delta?: number, spec?: LatticeSpec): CVector {
  const { l2 } = makeLattice(spec);
  return applyDisplacement(v, l2[0] / 2, l2[1] / 2, delta);
}

/** Stabilizer along the first lattice generator. */
export function stabilizerSqOp(v: CVector, delta?: number, spec?: LatticeSpec): CVector {
  const { l1 } = makeLattice(spec);
  return applyDisplacement(v, l1[0], l1[1], delta);
}

/** Stabilizer along the second lattice generator. */
export function stabilizerSpOp(v: CVector, delta?: number, spec?: LatticeSpec): CVector {
  const { l2 } = makeLattice(spec);
  return applyDisplacement(v, l2[0], l2[1], delta);
}


export interface CMatrix {
  n: number;
  re: Float64Array;
  im: Float64Array;
}

export function densityFromVector(v: CVector): CMatrix {
  const n = v.re.length;
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // rho_ij = v_i * conj(v_j)
      re[i * n + j] = v.re[i] * v.re[j] + v.im[i] * v.im[j];
      im[i * n + j] = v.im[i] * v.re[j] - v.re[i] * v.im[j];
    }
  }
  return { n, re, im };
}

export function copyMatrix(m: CMatrix): CMatrix {
  return { n: m.n, re: new Float64Array(m.re), im: new Float64Array(m.im) };
}

export interface Diagnostics {
  purity: number;
  meanPhotons: number;
  trace: number;
  tailPopulation: number;
}

export function diagnostics(rho: CMatrix): Diagnostics {
  const n = rho.n;
  let trace = 0;
  let meanPhotons = 0;
  let purity = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    const d = rho.re[i * n + i];
    trace += d;
    meanPhotons += i * d;
    if (i >= n - 5) tail += d;
  }
  for (let i = 0; i < n * n; i++) {
    purity += rho.re[i] * rho.re[i] + rho.im[i] * rho.im[i];
  }
  return { purity, meanPhotons, trace, tailPopulation: tail };
}

/* ------------------------------------------------------------------ *
 * Finite-energy (envelope-deformed) stabilizers
 *
 * A physical GKP state is |psi_D> = E_D |ideal> with E_D = exp(-delta^2 n).
 * It is an exact eigenstate (eigenvalue 1) of the deformed stabilizers
 *     S_D = E_D S E_D^{-1},   S = D(2 sqrt(pi) along q or p),
 * so <S_D> = 1 for a freshly prepared state at any delta, and drops only
 * because the state has actually left the (physical) code space.
 * ------------------------------------------------------------------ */

const dispCache = new Map<string, CMatrix>();

/** Matrix elements of D(alpha) in the Fock basis, column by column. */
export function displacementMatrix(n: number, alphaRe: number, alphaIm: number): CMatrix {
  const key = `${n}|${alphaRe}|${alphaIm}`;
  const hit = dispCache.get(key);
  if (hit) return hit;
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let k = 0; k < n; k++) {
    const e = zeroVector(n);
    e.re[k] = 1;
    const col = displace(e, alphaRe, alphaIm);
    for (let j = 0; j < n; j++) {
      re[j * n + k] = col.re[j];
      im[j * n + k] = col.im[j];
    }
  }
  const m: CMatrix = { n, re, im };
  if (dispCache.size > 8) dispCache.clear();
  dispCache.set(key, m);
  return m;
}

/** Re Tr[rho E_D D(alpha) E_D^{-1}] / Tr rho. */
function deformedExpectation(
  rho: CMatrix,
  delta: number,
  alphaRe: number,
  alphaIm: number,
): number {
  const n = rho.n;
  const D = displacementMatrix(n, alphaRe, alphaIm);
  const d2 = delta * delta;
  let trace = 0;
  for (let i = 0; i < n; i++) trace += rho.re[i * n + i];
  if (!(Math.abs(trace) > 1e-12)) return 0;

  let acc = 0;
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      // (E D E^{-1})_{kj} = exp(-d2 k) D_kj exp(+d2 j)
      const w = Math.exp(d2 * (j - k));
      if (!Number.isFinite(w)) continue;
      const rr = rho.re[j * n + k];
      const ri = rho.im[j * n + k];
      const dr = D.re[k * n + j];
      const di = D.im[k * n + j];
      acc += w * (rr * dr - ri * di);
    }
  }
  const v = acc / trace;
  if (!Number.isFinite(v)) return 0;
  return Math.max(-2, Math.min(2, v));
}

export interface StabilizerStats {
  sq: number;
  sp: number;
}

/** Finite-energy stabilizer expectations along q and p (1 = in code space). */
export function stabilizerStats(
  rho: CMatrix,
  delta: number,
  spec?: LatticeSpec,
): StabilizerStats {
  const { l1, l2 } = makeLattice(spec);
  const [a1r, a1i] = toAlpha(l1[0], l1[1]);
  const [a2r, a2i] = toAlpha(l2[0], l2[1]);
  return {
    sq: deformedExpectation(rho, delta, a1r, a1i),
    sp: deformedExpectation(rho, delta, a2r, a2i),
  };
}
