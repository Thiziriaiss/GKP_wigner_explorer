# Editable Fock truncation

Yes — this is straightforward, because every piece of the maths already takes the
truncation size as an argument. Only the worker currently hard-codes it (100).

## What the user gets

In the "Squeezing" area, next to the Δ slider, a small number box labelled
`N` (Fock cutoff) with a default of 100. Typing a value re-runs the whole
simulation at that truncation, and the existing "Fock truncation stressed here"
warning keeps telling you when N is too small for the chosen Δ.

Range: 20 to 200, clamped on entry.

- Small N is fast but a hard Δ (strong squeezing) will visibly clip: the tail
  population readout rises and the Wigner peaks distort.
- Large N is exact but cost grows fast: the Lindblad step and the Wigner grid
  both scale roughly as N², so 200 is noticeably slower than 100 per frame,
  especially with loss or dephasing turned on.

Add `tail population` as a shown diagnostic so the truncation quality is
visible next to purity and ⟨n⟩.

## Technical notes

- `protocol.ts`: keep `FOCK_CUTOFF = 100` as the default, add
  `FOCK_CUTOFF_MIN = 20` / `FOCK_CUTOFF_MAX = 200`, and add `cutoff: number`
  to `SimRequest`.
- `gkp.worker.ts`: the module-level `hermiteBasis(axes.fine, FOCK_CUTOFF)` is
  the only cutoff-bound precomputation. Replace it with a one-entry memo keyed
  by cutoff (`let cached = { n, basis }`), rebuilt when the request's cutoff
  changes; pass `req.cutoff` to `gkpState`. Everything else (`displace`,
  `evolve`, `wignerGrid`, `diagnostics`) already reads `n` off the data.
- `useGkpSimulation.ts`: add `cutoff` to `SimParams` and to the memo deps so a
  change triggers the debounced re-request.
- `index.tsx`: `const [cutoff, setCutoff] = useState(FOCK_CUTOFF)`, pass down,
  reset frame index on change (same effect that already watches delta).
- `ControlPanel.tsx`: number input styled like the existing `t_max` box, with
  clamping to [20, 200] on change.
