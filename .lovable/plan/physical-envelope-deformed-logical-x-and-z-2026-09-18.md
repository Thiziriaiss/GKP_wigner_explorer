# Physical (envelope-deformed) logical X and Z

Yes — it makes sense, and it fixes an inconsistency the app currently has.

The stabilizer readouts already use the finite-energy (envelope-deformed) versions, so a
freshly built state reads 1 at any squeezing. The X and Z buttons, however, still apply the
idealized \(\sqrt{\pi}\) displacements. Those are not the logicals of the deformed code, so
pressing X currently knocks the stabilizer value down from 1 to about 0.57 — an artefact of
mixing the two conventions, not a real error on the state.

The physical logicals are the same displacement dressed by the envelope:
\(X_\Delta = E_\Delta X E_\Delta^{-1}\), \(Z_\Delta = E_\Delta Z E_\Delta^{-1}\), with
\(E_\Delta = e^{-\Delta^2 \hat n}\). With those, a code word stays in the physical code space
after a flip: the stabilizers keep reading 1, and the peaks shift by half a code period exactly
as before.

## What changes for you

- The X and Z buttons apply the physical logicals by default, so the stabilizer readouts stay
  at 1 after a flip instead of dropping.
- A small toggle in the Logical operations section switches between **physical** and **ideal**
  displacements, so the difference is visible side by side — the point that ideal displacements
  are not the right logicals for a finite-energy code is worth being able to demonstrate.
- The hover definitions on X and Z update to show whichever convention is active, in terms of
  \(q\), \(p\) and \(\Delta\).

At large squeezing (small \(\Delta\)) the two versions almost coincide; the gap grows as
\(\Delta\) gets bigger, which is exactly the finite-energy correction.

## Technical notes

- `src/lib/quantum/state.ts`: add `deformedDisplace(v, alphaRe, alphaIm, delta)` — multiply by
  the diagonal \(e^{+\Delta^2 n}\), apply the existing `displace`, multiply by
  \(e^{-\Delta^2 n}\), renormalize (the operator is non-unitary). The growing factor is applied
  first on a normalized vector and the Fock tail is already monitored by the existing
  tail-population diagnostic, so no new stability machinery is needed.
  `logicalX`/`logicalZ` gain an optional `delta` argument; passing it selects the physical
  version, omitting it keeps the current ideal behaviour.
- `SimRequest` in `src/lib/quantum/protocol.ts` gains `physicalGates: boolean`; the worker
  passes `req.delta` through to the gate application when set. No change to grid size, frame
  count, or the Lindblad stepping.
- `src/routes/index.tsx` holds the `physicalGates` state (default true) and threads it into
  `useGkpSimulation`; `ControlPanel.tsx` renders the two-way toggle next to the X/Z buttons
  using the existing compact button styling, and the `HoverInfo` + `Tex` cards pick their
  formula from the active mode.
