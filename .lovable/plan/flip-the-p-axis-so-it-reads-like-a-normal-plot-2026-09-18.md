# Flip the p axis so it reads like a normal plot

## What you're seeing

Looking straight down on the surface, q increases to the right (correct), but p
increases *downward* instead of upward. That is because the depth direction of the
3D scene points toward the viewer, so growing p is drawn toward the bottom of the
screen. The values are right; only the drawing direction of p is mirrored compared
with the usual convention.

## The change

Draw p along the opposite depth direction, so that from a top-down view q goes
right and p goes up — the standard phase-space orientation.

- The surface (and the sample-line overlay) place each point at depth `-p` instead
  of `+p`.
- The p axis label and its tick marks (-4, -2, 2, 4) move with it, so the numbers
  still sit next to the coordinates they name.
- Nothing about the computed Wigner values, the colour scale, the diagnostics, or
  the simulation changes — this is purely which way the axis points on screen.

## Technical notes

In `src/components/wigner/WignerScene.tsx`, the geometry writes
`pos.setXYZ(idx, q, w * scale, p)`. The p component becomes negated in both the
smooth (Catmull-Rom resampled) surface and the coarse sample mesh. The axis label
at `[0, 0, limit + 1.3]` and the p ticks at `[0, -0.35, t]` are mirrored to
negative depth (`-limit - 1.3`, `-t`) so labels track the flipped direction. The
floor grid is symmetric, so it is unaffected.
