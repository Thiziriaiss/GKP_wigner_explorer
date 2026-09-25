import { useCallback, useEffect, useRef } from "react";

interface DeltaKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

const START_ANGLE = -135;
const SWEEP = 270;

/** Draggable rotary knob: drag vertically (or use arrow keys) to set delta. */
export function DeltaKnob({ value, min, max, onChange }: DeltaKnobProps) {
  const dragging = useRef<{ y: number; value: number } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const frac = (value - min) / (max - min);
  const angle = START_ANGLE + frac * SWEEP;

  const handleMove = useCallback(
    (clientY: number) => {
      const state = dragging.current;
      if (!state) return;
      const delta = (state.y - clientY) / 160;
      const next = Math.min(max, Math.max(min, state.value + delta * (max - min)));
      onChangeRef.current(Math.round(next * 1000) / 1000);
    },
    [min, max],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => handleMove(e.clientY);
    const up = () => {
      dragging.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [handleMove]);

  const arcPath = (from: number, to: number) => {
    const r = 34;
    const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
    const x1 = 40 + r * Math.cos(rad(from));
    const y1 = 40 + r * Math.sin(rad(from));
    const x2 = 40 + r * Math.cos(rad(to));
    const y2 = 40 + r * Math.sin(rad(to));
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div
      className="flex items-center gap-4 select-none"
      role="slider"
      tabIndex={0}
      aria-label="Squeezing parameter delta"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.05 : 0.01;
        if (e.key === "ArrowUp" || e.key === "ArrowRight")
          onChange(Math.min(max, Math.round((value + step) * 1000) / 1000));
        if (e.key === "ArrowDown" || e.key === "ArrowLeft")
          onChange(Math.max(min, Math.round((value - step) * 1000) / 1000));
      }}
    >
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        className="cursor-ns-resize touch-none"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          dragging.current = { y: e.clientY, value };
        }}
      >
        <circle cx="40" cy="40" r="30" className="fill-card stroke-border" strokeWidth="1" />
        <path
          d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
          className="stroke-border"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={arcPath(START_ANGLE, angle)}
          className="stroke-primary"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <line
          x1="40"
          y1="40"
          x2={40 + 20 * Math.cos(((angle - 90) * Math.PI) / 180)}
          y2={40 + 20 * Math.sin(((angle - 90) * Math.PI) / 180)}
          className="stroke-foreground"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="40" cy="40" r="3" className="fill-foreground" />
      </svg>
      <div className="font-mono text-sm">
        <div className="text-foreground">
          &Delta; = {value.toFixed(3)}
        </div>
        <div className="text-muted-foreground">
          {(-20 * Math.log10(value)).toFixed(1)} dB squeezing
        </div>
        <div className="mt-1 text-xs text-muted-foreground">drag vertically</div>
      </div>
    </div>
  );
}
