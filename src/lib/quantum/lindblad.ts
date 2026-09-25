// @ts-nocheck -- numeric kernel: typed-array indexing under noUncheckedIndexedAccess
/**
 * Lindblad evolution with photon loss L1 = sqrt(kappa1) a and dephasing
 * L2 = sqrt(kappaPhi) a†a.
 *
 * In the Fock basis the two dissipators take a cheap form:
 *   loss:      kappa1 * ( sqrt((m+1)(k+1)) rho_{m+1,k+1} - (m+k)/2 rho_{mk} )
 *   dephasing: -(kappaPhi/2) (m-k)^2 rho_{mk}
 *
 * Dephasing is exactly solvable (a pure multiplicative decay of coherences)
 * but extremely stiff at large |m-k|, so it is applied in closed form in a
 * Strang splitting around an RK4 step for the loss part. This keeps the
 * integration stable for any dephasing rate.
 */

import type { CMatrix } from "./state";

function lossDerivative(
  rho: CMatrix,
  kappa1: number,
  outRe: Float64Array,
  outIm: Float64Array,
) {
  const n = rho.n;
  for (let m = 0; m < n; m++) {
    for (let k = 0; k < n; k++) {
      const idx = m * n + k;
      let dr = 0;
      let di = 0;
      if (m + 1 < n && k + 1 < n) {
        const g = Math.sqrt((m + 1) * (k + 1));
        const j = (m + 1) * n + (k + 1);
        dr += g * rho.re[j];
        di += g * rho.im[j];
      }
      const damp = (m + k) / 2;
      dr -= damp * rho.re[idx];
      di -= damp * rho.im[idx];
      outRe[idx] = kappa1 * dr;
      outIm[idx] = kappa1 * di;
    }
  }
}

function applyDephasing(rho: CMatrix, kappaPhi: number, dt: number) {
  if (kappaPhi === 0 || dt === 0) return;
  const n = rho.n;
  for (let m = 0; m < n; m++) {
    for (let k = 0; k < n; k++) {
      const d = m - k;
      if (d === 0) continue;
      const f = Math.exp((-kappaPhi * d * d * dt) / 2);
      const idx = m * n + k;
      rho.re[idx] *= f;
      rho.im[idx] *= f;
    }
  }
}

/** Advance rho in place by `steps` split-step increments of size dt. */
export function evolve(
  rho: CMatrix,
  kappa1: number,
  kappaPhi: number,
  dt: number,
  steps: number,
): void {
  const n = rho.n;
  const len = n * n;
  const k1r = new Float64Array(len);
  const k1i = new Float64Array(len);
  const k2r = new Float64Array(len);
  const k2i = new Float64Array(len);
  const k3r = new Float64Array(len);
  const k3i = new Float64Array(len);
  const k4r = new Float64Array(len);
  const k4i = new Float64Array(len);
  const tmp: CMatrix = { n, re: new Float64Array(len), im: new Float64Array(len) };

  const mix = (a: Float64Array, b: Float64Array, s: number, target: Float64Array) => {
    for (let i = 0; i < len; i++) target[i] = a[i] + s * b[i];
  };

  for (let s = 0; s < steps; s++) {
    applyDephasing(rho, kappaPhi, dt / 2);
    if (kappa1 !== 0) {
      lossDerivative(rho, kappa1, k1r, k1i);
      mix(rho.re, k1r, dt / 2, tmp.re);
      mix(rho.im, k1i, dt / 2, tmp.im);
      lossDerivative(tmp, kappa1, k2r, k2i);
      mix(rho.re, k2r, dt / 2, tmp.re);
      mix(rho.im, k2i, dt / 2, tmp.im);
      lossDerivative(tmp, kappa1, k3r, k3i);
      mix(rho.re, k3r, dt, tmp.re);
      mix(rho.im, k3i, dt, tmp.im);
      lossDerivative(tmp, kappa1, k4r, k4i);
      for (let i = 0; i < len; i++) {
        rho.re[i] += (dt / 6) * (k1r[i] + 2 * k2r[i] + 2 * k3r[i] + k4r[i]);
        rho.im[i] += (dt / 6) * (k1i[i] + 2 * k2i[i] + 2 * k3i[i] + k4i[i]);
      }
    }
    applyDephasing(rho, kappaPhi, dt / 2);
  }
}
