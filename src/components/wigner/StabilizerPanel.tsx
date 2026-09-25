import { X } from "lucide-react";

import type { FrameStats } from "@/lib/quantum/protocol";

import { Tex } from "./Tex";

interface StabilizerPanelProps {
  stats: Array<FrameStats | undefined>;
  activeIndex: number;
  onClose: () => void;
}

const W = 340;
const H = 190;
const PAD = { left: 34, right: 10, top: 12, bottom: 24 };

const SERIES: Array<{ key: "sq" | "sp"; label: string; color: string }> = [
  { key: "sq", label: String.raw`\langle \hat S_{\Delta,q}\rangle`, color: "#0d3da8" },
  { key: "sp", label: String.raw`\langle \hat S_{\Delta,p}\rangle`, color: "#b8141c" },
];

export function StabilizerPanel({ stats, activeIndex, onClose }: StabilizerPanelProps) {
  const points = stats.filter((s): s is FrameStats => Boolean(s));
  const tMax = Math.max(1e-6, ...points.map((s) => s.time));
  const values = points.flatMap((s) => [s.sq, s.sp]);
  const lo = Math.min(0, ...values);
  const hi = Math.max(1, ...values);
  const span = Math.max(1e-6, hi - lo);

  const x = (t: number) => PAD.left + (t / tMax) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);

  const active = stats[activeIndex];

  const ticks = [lo, lo + span / 2, hi];

  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-10 rounded-md border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-[0.6rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Stabilizers vs time
        </h3>
        <button
          onClick={onClose}
          aria-label="Close stabilizer plot"
          className="ml-auto rounded border border-border p-0.5 text-muted-foreground transition-colors hover:bg-accent"
        >
          <X className="size-2.5" />
        </button>
      </div>

      <svg width={W} height={H} role="img" aria-label="Stabilizer expectation values over time">
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 4}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              fontSize={8}
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="currentColor"
          className="text-foreground"
          strokeWidth={1}
        />
        <text
          x={W - PAD.right}
          y={H - PAD.bottom + 14}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize={8}
        >
          t = {tMax.toFixed(2)}
        </text>
        <text
          x={PAD.left}
          y={H - PAD.bottom + 14}
          className="fill-muted-foreground font-mono"
          fontSize={8}
        >
          0
        </text>

        {SERIES.map((s) => {
          const path = points
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.time).toFixed(1)},${y(p[s.key]).toFixed(1)}`)
            .join(" ");
          return (
            <g key={s.key}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={1.6} />
              {points.length === 1 && points[0] && (
                <circle cx={x(points[0].time)} cy={y(points[0][s.key])} r={2.5} fill={s.color} />
              )}
            </g>
          );
        })}

        {active && (
          <line
            x1={x(active.time)}
            x2={x(active.time)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="currentColor"
            className="text-foreground"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      <div className="mt-1 flex items-center gap-3">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[0.62rem]">
            <span className="inline-block h-0.5 w-3" style={{ backgroundColor: s.color }} />
            <Tex className="text-muted-foreground">{s.label}</Tex>
            <span className="text-foreground">{active ? active[s.key].toFixed(4) : "—"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default StabilizerPanel;
