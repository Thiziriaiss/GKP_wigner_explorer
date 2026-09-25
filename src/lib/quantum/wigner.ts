// @ts-nocheck -- numeric kernel: typed-array indexing under noUncheckedIndexedAccess
/**
 * Wigner function of a Fock-basis density matrix, computed through the
 * position representation:
 *
 *   rho(u, v) = sum_{m,n} psi_m(u) rho_{mn} psi_n(v)
 *   W(x, p)   = (1 / 2pi) integral dy rho(x + y/2, x - y/2) e^{-i p y}
 *
 * Sampling u, v on a lattice of spacing h and taking y = 2kh keeps every
 * required rho(u, v) on the lattice, giving p-bandwidth pi / (2h).
 */

import type { CMatrix } from "./state";

export interface WignerAxes {
  /** Output grid values along x (same values used for p). */
  coords: Float64Array;
  /** Fine position lattice used internally. */
  fine: Float64Array;
  h: number;
  /** Index into `fine` for each output coordinate. */
  centerIdx: Int32Array;
}

export function makeAxes(limit: number, gridSize: number, h = 0.05): WignerAxes {
  const half = Math.round(limit / h);
  const fineCount = 2 * half + 1;
  const fine = new Float64Array(fineCount);
  for (let i = 0; i < fineCount; i++) fine[i] = (i - half) * h;

  const coords = new Float64Array(gridSize);
  const centerIdx = new Int32Array(gridSize);
  for (let i = 0; i < gridSize; i++) {
    const frac = gridSize === 1 ? 0.5 : i / (gridSize - 1);
    const idx = Math.round(frac * (fineCount - 1));
    centerIdx[i] = idx;
    coords[i] = fine[idx];
  }
  return { coords, fine, h, centerIdx };
}

/** psi[i * n + k] = k-th oscillator eigenfunction evaluated at fine[i]. */
export function hermiteBasis(fine: Float64Array, n: number): Float64Array {
  const out = new Float64Array(fine.length * n);
  const norm = Math.PI ** -0.25;
  for (let i = 0; i < fine.length; i++) {
    const x = fine[i];
    let prev = 0;
    let cur = norm * Math.exp(-0.5 * x * x);
    out[i * n] = cur;
    for (let k = 1; k < n; k++) {
      const next = x * Math.sqrt(2 / k) * cur - Math.sqrt((k - 1) / k) * prev;
      out[i * n + k] = next;
      prev = cur;
      cur = next;
    }
  }
  return out;
}

export interface WignerGrid {
  size: number;
  values: Float64Array;
  min: number;
  max: number;
}

/**
 * Wigner function on a gridSize x gridSize lattice. `values[ix * size + ip]`
 * holds W(x_ix, p_ip).
 */
export function wignerGrid(rho: CMatrix, axes: WignerAxes, basis: Float64Array): WignerGrid {
  const n = rho.n;
  const fineCount = axes.fine.length;
  const size = axes.coords.length;

  // C[k * fineCount + j] = sum_m rho_{km} psi_m(fine_j)
  const cRe = new Float64Array(n * fineCount);
  const cIm = new Float64Array(n * fineCount);
  for (let k = 0; k < n; k++) {
    for (let m = 0; m < n; m++) {
      const rr = rho.re[k * n + m];
      const ri = rho.im[k * n + m];
      if (rr === 0 && ri === 0) continue;
      for (let j = 0; j < fineCount; j++) {
        const b = basis[j * n + m];
        cRe[k * fineCount + j] += rr * b;
        cIm[k * fineCount + j] += ri * b;
      }
    }
  }

  const rhoPos = (uIdx: number, vIdx: number): [number, number] => {
    let re = 0;
    let im = 0;
    for (let k = 0; k < n; k++) {
      const b = basis[uIdx * n + k];
      if (b === 0) continue;
      re += b * cRe[k * fineCount + vIdx];
      im += b * cIm[k * fineCount + vIdx];
    }
    return [re, im];
  };

  const values = new Float64Array(size * size);
  const scale = axes.h / Math.PI;
  let min = Infinity;
  let max = -Infinity;

  // Precompute the correlation strip for each output x.
  const maxK = Math.floor((fineCount - 1) / 2);
  const stripRe = new Float64Array(maxK + 1);
  const stripIm = new Float64Array(maxK + 1);

  for (let ix = 0; ix < size; ix++) {
    const j = axes.centerIdx[ix];
    const kMax = Math.min(j, fineCount - 1 - j);
    for (let k = 0; k <= kMax; k++) {
      const [re, im] = rhoPos(j + k, j - k);
      stripRe[k] = re;
      stripIm[k] = im;
    }
    for (let ip = 0; ip < size; ip++) {
      const p = axes.coords[ip];
      const dphi = 2 * axes.h * p;
      let sum = stripRe[0];
      for (let k = 1; k <= kMax; k++) {
        const ang = dphi * k;
        sum += 2 * (stripRe[k] * Math.cos(ang) + stripIm[k] * Math.sin(ang));
      }
      const w = sum * scale;
      values[ix * size + ip] = w;
      if (w < min) min = w;
      if (w > max) max = w;
    }
  }

  return { size, values, min, max };
}
