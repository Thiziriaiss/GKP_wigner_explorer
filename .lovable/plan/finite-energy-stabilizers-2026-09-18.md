# Finite-energy stabilizers

Add code-space quality measures to the explorer, plus an optional panel showing how they evolve in time.

The stabilizers used are the finite-energy (envelope-deformed) ones, not the ideal-lattice displacements. A physical GKP state is an exact eigenstate of these, so a freshly built state reads 1 regardless of how strongly you squeeze, and any drop away from 1 is genuinely caused by the noise rather than by the state being finite-energy.

## What you get

**In the diagnostics list (always visible, updates per frame)**

- `<S_q>` and `<S_p>` — the two finite-energy stabilizer expectation values. 1 means the state is exactly in the (physical) code space; the value falls as loss and dephasing push it out.

**A "Stabilizers vs time" panel (hidden until you ask for it)**

- A small button in the Time evolution section opens a panel over the plot area showing both stabilizer values as curves against time.
- The curves fill in as the animation plays, and a marker follows the current frame.
- The panel closes with an X, so the default layout stays uncrowded.
- With loss and dephasing both at zero there is a single time point, so the panel shows just that value.

## Technical notes

- New helpers in `src/lib/quantum/state.ts`:
  - `envelope(n, delta, sign)` — the diagonal operator `exp(∓Δ²·n̂)` in the Fock basis.
  - `finiteEnergyStabilizer(rho, delta, axis)` — expectation of `S_Δ = E_Δ S E_Δ^{-1}` with `E_Δ = exp(-Δ²·n̂)` and `S` the ideal `2√π` displacement along q or p (consistent with the existing `√π` logical displacements). Computed as `Tr[rho · E_Δ D E_Δ^{-1}]` by applying the diagonal envelope factors elementwise to the displacement matrix built from the existing generator, then contracting with rho. Reported as the real part, normalised by `Tr[rho · E_Δ E_Δ^{-1}] = Tr rho = 1`.
  - Because `E_Δ^{-1}` grows as `e^{+Δ²n}`, the contraction is done in log-space-safe order and the result is clamped for display when the Fock tail population is non-negligible; the existing tail-population diagnostic already warns when the truncation is too small for the chosen Δ.
- `FrameStats` in `src/lib/quantum/protocol.ts` gains `sq` and `sp`; the worker fills them alongside the existing diagnostics per frame, passing the current `delta` through. No change to grid size, frame count, or the Lindblad stepping.

- `src/hooks/useGkpSimulation.ts` already accumulates frames, so the full stats history is available for the time curves with no protocol change.
- New `src/components/wigner/StabilizerPanel.tsx`: a plain SVG line chart (no new dependency) rendered as an absolutely positioned card inside the plot container in `src/routes/index.tsx`, gated on an `open` state toggled from `ControlPanel.tsx`. Uses the existing light scientific tokens and the same compact type sizes as the rest of the panel.
- Diagnostics rows reuse the existing compact `Row` helper, so the control column keeps its current size.
