# Choosable code lattice spacing

Right now the code is hard-wired to the square GKP lattice: peaks every 2√π along q
and p, logical flips by √π, stabilizers by 2√π. The plan adds a control for the
lattice shape/spacing, so everything on screen follows the choice you make.

## What you get

A new "Code lattice" setting at the top of the controls with three presets:

- **Square (default)** — the standard qubit GKP lattice, spacing 2√π. Same as today.
- **Rectangular** — you pick an aspect ratio r: peaks every 2√π·r along q and
  2√π/r along p. Squeezes the code in one quadrature and stretches it in the other,
  same code area (so same logical dimension). Useful to see the trade-off between
  q errors and p errors.
- **Hexagonal** — the triangular/hex lattice, the most error-robust qubit GKP code
  at fixed energy. Peaks sit on a hexagonal grid of the same unit-cell area.

Why these and not an arbitrary number: the lattice area is fixed by the fact that
the code encodes one qubit (unit cell of area 4π). A free spacing knob would silently
change how many logical states the code has, which isn't physically meaningful. The
aspect ratio and the hex option are exactly the physical freedom that remains.

Everything downstream follows the choice:

- the peak comb that builds |0_L⟩, |1_L⟩, |±_L⟩
- the logical X and Z displacements (half a lattice vector)
- the finite-energy stabilizer readouts and the stabilizer buttons
- the faint reference grid on the plot floor and the axis tick marks

## Technical details

- `state.ts`: add a `Lattice` descriptor holding the two primitive vectors
  (square: (2√π, 0), (0, 2√π); rectangular: scaled by r and 1/r; hex: (a, 0),
  (a/2, a√3/2) with a chosen so the cell area stays 4π). Replace the hard-coded
  √π / 2√π constants in `combState`, `gkpState`, `logicalX`, `logicalZ`,
  `stabilizerSqOp`, `stabilizerSpOp`, `stabilizerStats` with vectors derived from
  the descriptor. `combState` becomes a 2D sum over lattice sites for hex (a comb
  of displaced squeezed states along the two primitive directions), still truncated
  by the Δ envelope cut-off already used.
- `protocol.ts`: `SimRequest` gains `lattice: { kind: "square" | "rect" | "hex"; ratio: number }`;
  the worker threads it into state construction, gate application and stabilizer stats.
- `useGkpSimulation.ts` / `index.tsx`: new state, debounced re-request as with Δ.
- `ControlPanel.tsx`: preset buttons plus a compact aspect-ratio slider (0.5–2)
  shown only for the rectangular preset, each with a KaTeX hover card giving the
  primitive vectors and the resulting stabilizers.
- `WignerScene.tsx`: floor grid drawn from the lattice vectors instead of a fixed
  √π square grid; ticks labelled in units of the lattice period along each axis.

Cost: no extra per-frame work — the lattice only affects how the initial state and
the operators are built, so animation speed is unchanged. Hexagonal state
construction is slightly slower at build time (a 2D instead of 1D sum).
