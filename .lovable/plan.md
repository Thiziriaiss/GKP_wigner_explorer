# Hexagonal code lattice — done properly

Short answer: it is doable, but not by the route that was tried before. The earlier
attempt failed because the state was built as a comb of *round* squeezed peaks placed
on hexagonal sites. A hexagonal code needs the peaks themselves tilted and stretched
to match the oblique lattice, which is why the code-space readouts came out at ~1.4
instead of 1. The clean fix is to stop hand-placing peaks and instead take the square
code word and geometrically transform it.

## Approach

Any code lattice with the same unit-cell area (one encoded qubit) is related to the
square one by an area-preserving transformation of phase space. That transformation has
a known realisation as a physical operation on the state: a rotation, a squeeze, and
another rotation. So:

1. Build the ordinary square GKP code word at the chosen squeezing (existing code).
2. Apply the rotation–squeeze–rotation that maps the square lattice onto the hexagonal
   one. The result is a genuine hexagonal code word: correctly tilted peaks, correct
   envelope, unchanged photon budget scaling.
3. Operators (logical flips and stabilizers) follow the same geometry: they are shifts
   along the hexagonal lattice vectors, and the finite-energy versions are obtained by
   transforming back, applying the square finite-energy operator, and transforming
   forward again — so a fresh hexagonal code word reads exactly 1 on both stabilizers
   at any squeezing, as it should.

## What changes in the app

- "Code lattice" section gains a third preset: hexagonal (alongside square and
  rectangular).
- Plot floor grid, tick spacing and the caption follow the hexagonal cell.
- The logical X / Z buttons and the two stabilizer buttons act along the hexagonal
  lattice directions, in both the physical and ideal conventions.
- Diagnostics keep their meaning; for a freshly built hexagonal state both stabilizer
  readouts must show 1.00 — this is the acceptance test.

## Technical notes

- Add a general squeeze operator acting on an arbitrary Fock vector (same
  scaling + Taylor pattern already used for `displace`), plus rotation as diagonal
  phases `e^{-i k theta}`.
- Derive the 2x2 symplectic `S` mapping square generators to hexagonal ones
  (`l1 = (a, 0)`, `l2 = (a/2, a sqrt3/2)`, `a^2 = 8 pi / sqrt3`, so `det S = 1`), then
  decompose it by SVD into rotation x diagonal squeeze x rotation, fixing signs so both
  orthogonal factors are proper rotations.
- Build `U_S` once as a cached Fock matrix (columns = transformed basis states), keyed
  on cutoff + lattice. Use it to (a) produce the hexagonal code word from the square
  one, (b) conjugate the density matrix for the finite-energy stabilizer readouts
  (`rho -> U_S^dagger rho U_S`, evaluate the square deformed stabilizer), and (c)
  conjugate the deformed gate action for the X / Z / stabilizer buttons.
- Ideal-convention operators need no conjugation: displacements are already covariant,
  so they stay plain shifts by half / full lattice vectors.
- Per-frame cost: two extra n x n matrix products at the stats step, negligible next to
  the existing Wigner evaluation. Animation speed unchanged.
- Verification: a standalone `bun` script checking fresh-state stabilizer readouts at
  delta = 0.2 / 0.3 / 0.45 on all three lattices, then a browser pass for console
  errors and the rendered grid.
