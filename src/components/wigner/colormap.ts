/** Diverging blue -> white -> red colormap for signed Wigner values. */
export function divergingColor(t: number): [number, number, number] {
  const c = Math.max(-1, Math.min(1, t));
  // Endpoint colors chosen for a light, print-like scientific figure.
  const neg: [number, number, number] = [0.05, 0.24, 0.66];
  const pos: [number, number, number] = [0.72, 0.08, 0.11];
  const mid: [number, number, number] = [0.985, 0.985, 0.975];
  // Gamma < 1 keeps the shallow negative lobes clearly visible.
  const a = Math.abs(c) ** 0.42;
  const end = c < 0 ? neg : pos;
  return [
    mid[0] + (end[0] - mid[0]) * a,
    mid[1] + (end[1] - mid[1]) * a,
    mid[2] + (end[2] - mid[2]) * a,
  ];
}
