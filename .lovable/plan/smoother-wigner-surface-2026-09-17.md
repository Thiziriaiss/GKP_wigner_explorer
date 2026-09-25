# Smoother Wigner surface

## How the mesh is chosen today

Fixed and uniform: 81 x 81 evenly spaced sample points spanning q, p in
[-6, +6] (spacing ~0.15). Each of those 6561 points is a real Wigner
computation, and the surface is drawn by joining neighbouring points with
straight triangles — so the faceted look comes from the point spacing, not
from the shading.

## The plan

Keep computing exactly the same 81 x 81 real values, but draw the surface
through a smooth interpolation of those values at 3x density (241 x 241).
This is pure geometry work on the graphics side: no extra physics, no slower
animation, and it removes the visible facets.

The thin wireframe overlay stays on the true 81 x 81 sample lines so you can
still see where the real data points sit, with a checkbox to hide it.

Interpolated smoothing does not invent physics: between real samples it draws
the smooth curve those samples imply, which for a Wigner function of a
band-limited state is very close to the truth. The colour bar and the
diagnostics keep reporting the real computed samples.

## Technical notes

- `WignerScene.tsx`: add a Catmull-Rom (bicubic) resample of `values` and
  `coords` onto a `size * 3 - 2` display lattice, computed in the existing
  position/colour `useEffect`; geometry index buffer keyed by display size.
  Colour still evaluated per display vertex from the interpolated value with
  the same `w / W_BOUND` mapping. Keep `computeVertexNormals`. Move the
  wireframe onto a separate coarse geometry built from the raw grid, behind a
  `showSamples` prop.
- `index.tsx`: `showSamples` state passed to `WignerScene` and `ControlPanel`.
- `ControlPanel.tsx`: "sample grid" checkbox in a compact Rendering row.
- No change to the worker, protocol, or simulation hook — sample count stays
  at `GRID_SIZE = 81`.
