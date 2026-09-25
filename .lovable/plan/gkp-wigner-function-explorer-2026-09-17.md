# GKP Wigner Function Explorer

An interactive 3D visualization of the Wigner function of a finite-energy (physical) square-lattice GKP qubit, with logical operations and open-system dynamics.

## What the user gets

A single full-screen page:

- **3D Wigner surface** in the center. Height and color show W(q, p): blue for negative, red for positive, white at zero. Light scientific styling — white background, thin axes, subtle grid floor, q/p tick labels.
- **Mouse orbit**: drag to rotate the surface freely, scroll to zoom, so all faces and the negative lobes are visible from any angle.
- **Squeezing knob** for delta (roughly 0.05 to 0.5), draggable. The state and plot update live as it turns; a readout shows delta in both linear and dB.
- **State selector**: logical |0>, |1>, |+>, |-> on the square lattice.
- **Logical gates**: buttons for a bit flip (X) and a phase flip (Z), applied as sqrt(pi) phase-space displacements. Applying X to |0> visibly slides the lattice of peaks by half a code period; Z does the same along the other axis. A reset button restores the chosen basis state.
- **Noise dynamics**: sliders for photon loss rate kappa_1 and dephasing rate kappa_phi, plus a play/pause control and a time scrubber. Playing animates the Wigner function decaying: the peaks damp toward the vacuum for loss, and the negative interference fringes wash out for dephasing.
- **Live diagnostics** panel: purity, mean photon number, and the most-negative Wigner value at the current time, so the user can watch non-classicality die.

## Physics

- Finite-energy GKP state built in a truncated Fock basis (cutoff around 60): the ideal comb of squeezed peaks with an overall Gaussian envelope set by delta, normalized numerically.
- Logical X and Z are sqrt(pi) displacements along q and p, applied to the state vector via the displacement operator in the Fock basis.
- Open dynamics solve the Lindblad master equation with jump operators sqrt(kappa_1)·a (photon loss) and sqrt(kappa_phi)·a†a (dephasing), integrated with a fixed-step RK4 on the density matrix over a fixed time window. Time steps are pre-computed once per parameter change, then the scrubber and play button replay them instantly.
- Wigner function evaluated on a grid (about 81x81 over q,p in [-6, 6]) from the density matrix using the standard Fock-basis Wigner kernel with Laguerre-type recursion.

## Technical notes

- React + TanStack Start route at `/`, replacing the placeholder index.
- 3D rendering with React Three Fiber + drei `OrbitControls`, on a client-only route (`ssr: false`) so the canvas never renders on the server. The surface is a custom `BufferGeometry` with per-vertex colors from the diverging colormap, plus a matching wireframe overlay for readability.
- All quantum math in plain TypeScript modules (complex matrix ops, Fock operators, displacement, RK4 Lindblad, Wigner grid), no numerical dependency.
- Heavy work (state construction, time evolution, Wigner grids) runs in a Web Worker so knob dragging and rotation stay smooth; the UI shows a small progress indicator while a run computes.
- Debounced recompute on delta / kappa changes; the animation itself replays cached frames.
- Semantic design tokens in `src/styles.css` for the light scientific palette; route `head()` with a GKP-specific title and description.

## Build order

1. Quantum core modules + unit sanity checks (normalization, vacuum Wigner equals a Gaussian, trace preservation under evolution).
2. Web Worker wrapper and typed message protocol.
3. 3D surface component with orbit controls, colormap, axes.
4. Control panel: state selector, delta knob, X/Z buttons, noise sliders, time transport, diagnostics.
5. Verify in the browser with screenshots at several delta values and times.
