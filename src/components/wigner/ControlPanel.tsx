import { LineChart, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import {
  FOCK_CUTOFF_MAX,
  FOCK_CUTOFF_MIN,
  type FrameStats,
} from "@/lib/quantum/protocol";
import type { GateKind, LatticeKind, LogicalState } from "@/lib/quantum/state";

import { HoverInfo } from "./HoverInfo";
import { Tex } from "./Tex";

const LOGICALS: Array<{
  key: LogicalState;
  label: string;
  title: string;
  expr: string;
}> = [
  {
    key: "0",
    label: "|0_L\\rangle",
    title: "Logical zero (finite energy)",
    expr: String.raw`\begin{gathered}
    |0_L\rangle \propto \hat E_\Delta \sum_{s\in\mathbb{Z}} |q = 2s\sqrt{\pi}\rangle \\[2pt]
    \hat E_\Delta = e^{-\Delta^2 \hat a^\dagger \hat a}
    \end{gathered}`,
  },
  {
    key: "1",
    label: "|1_L\\rangle",
    title: "Logical one (finite energy)",
    expr: String.raw`\begin{gathered}
    |1_L\rangle \propto \hat E_\Delta \sum_{s\in\mathbb{Z}} |q = (2s{+}1)\sqrt{\pi}\rangle \\[2pt]
    \hat E_\Delta = e^{-\Delta^2 \hat a^\dagger \hat a}
    \end{gathered}`,
  },
  {
    key: "+",
    label: "|{+}_L\\rangle",
    title: "Logical plus (finite energy)",
    expr: String.raw`\begin{gathered}
    |{+}_L\rangle \propto \hat E_\Delta \sum_{s\in\mathbb{Z}} |p = 2s\sqrt{\pi}\rangle \\[2pt]
    = \tfrac{1}{\sqrt2}\big(|0_L\rangle + |1_L\rangle\big)
    \end{gathered}`,
  },
  {
    key: "-",
    label: "|{-}_L\\rangle",
    title: "Logical minus (finite energy)",
    expr: String.raw`\begin{gathered}
    |{-}_L\rangle \propto \hat E_\Delta \sum_{s\in\mathbb{Z}} |p = (2s{+}1)\sqrt{\pi}\rangle \\[2pt]
    = \tfrac{1}{\sqrt2}\big(|0_L\rangle - |1_L\rangle\big)
    \end{gathered}`,
  },
];



interface ControlPanelProps {
  delta: number;
  onDelta: (v: number) => void;
  cutoff: number;
  onCutoff: (v: number) => void;
  logical: LogicalState;
  onLogical: (v: LogicalState) => void;
  gates: Array<GateKind>;
  onGate: (g: GateKind) => void;
  onReset: () => void;

  kappa1: number;
  onKappa1: (v: number) => void;
  kappaPhi: number;
  onKappaPhi: (v: number) => void;
  timeWindow: number;
  onTimeWindow: (v: number) => void;
  playing: boolean;
  onPlaying: (v: boolean) => void;
  frameIndex: number;
  onFrameIndex: (v: number) => void;
  frameCount: number;
  loadedFrames: number;
  stats: FrameStats | null;
  computing: boolean;
  truncationWarning: boolean;
  showStabilizers: boolean;
  onShowStabilizers: (v: boolean) => void;
  latticeKind: LatticeKind;
  onLatticeKind: (v: LatticeKind) => void;
  latticeRatio: number;
  onLatticeRatio: (v: number) => void;
  width?: number;
}

const LATTICES: Array<{ key: LatticeKind; label: string; title: string; expr: string }> = [
  {
    key: "square",
    label: String.raw`\text{square}`,
    title: "Square code lattice",
    expr: String.raw`\begin{gathered}
    \vec v_1 = (2\sqrt{\pi},\,0),\quad \vec v_2 = (0,\,2\sqrt{\pi}) \\[2pt]
    \text{cell area } = 4\pi \text{ (one qubit)}
    \end{gathered}`,
  },
  {
    key: "rect",
    label: String.raw`\text{rect}`,
    title: "Rectangular code lattice",
    expr: String.raw`\begin{gathered}
    \vec v_1 = (2\sqrt{\pi}\,r,\,0),\quad \vec v_2 = (0,\,2\sqrt{\pi}/r) \\[2pt]
    \text{cell area } = 4\pi \text{ (one qubit)}
    \end{gathered}`,
  },
];

function Row({
  label,
  value,
  info,
}: {
  label: string;
  value: string;
  info?: React.ReactNode;
}) {
  const labelNode = (
    <Tex
      className={`text-[0.66rem] text-foreground ${
        info ? "cursor-help underline decoration-dotted underline-offset-2" : ""
      }`}
    >
      {label}
    </Tex>
  );
  return (
    <div className="flex items-baseline justify-between gap-2">
      {info ? (
        <HoverInfo align="left" info={info}>
          {labelNode}
        </HoverInfo>
      ) : (
        labelNode
      )}
      <span className="font-mono text-[0.6rem] text-foreground">{value}</span>
    </div>
  );
}

const TAIL_INFO = (
  <>
    <p className="mb-1 font-semibold">Truncation error</p>
    <Tex block>{String.raw`\sum_{n > N-5} \rho_{nn}`}</Tex>
    <p>
      Population sitting in the top five Fock levels of the truncated basis. It measures how much of
      the state is pressing against the cutoff <Tex>{String.raw`N`}</Tex>: if it is small (
      <Tex>{String.raw`\lesssim 10^{-6}`}</Tex>) the simulation is trustworthy, and if it grows the
      cutoff is too low for this squeezing and you should raise <Tex>{String.raw`N`}</Tex>.
    </p>
  </>
);

const SQ_INFO = (
  <>
    <p className="mb-1 font-semibold">Finite-energy stabilizer along q</p>
    <Tex block>
      {String.raw`\hat S_{\Delta,q} = \hat E_\Delta\, e^{\,i\,2\sqrt{\pi}\,\hat p}\, \hat E_\Delta^{-1},
      \qquad \hat E_\Delta = e^{-\Delta^2 \hat a^\dagger \hat a}`}
    </Tex>
  </>
);

const SP_INFO = (
  <>
    <p className="mb-1 font-semibold">Finite-energy stabilizer along p</p>
    <Tex block>
      {String.raw`\hat S_{\Delta,p} = \hat E_\Delta\, e^{-i\,2\sqrt{\pi}\,\hat q}\, \hat E_\Delta^{-1},
      \qquad \hat E_\Delta = e^{-\Delta^2 \hat a^\dagger \hat a}`}
    </Tex>
  </>
);



const X_INFO_PHYSICAL = (
  <>
    <p className="mb-1 font-semibold">Logical bit flip (physical)</p>
    <Tex block>{String.raw`\hat X_\Delta = \hat E_\Delta\, e^{\,i\sqrt{\pi}\,\hat p}\, \hat E_\Delta^{-1},\quad \hat E_\Delta = e^{-\Delta^2 \hat a^\dagger \hat a}`}</Tex>
    <p>
      The <Tex>{String.raw`\sqrt{\pi}`}</Tex> shift in <Tex>{String.raw`q`}</Tex> dressed by the
      envelope, so a physical code word stays in the finite-energy code space:{" "}
      <Tex>{String.raw`\langle \hat S_\Delta\rangle`}</Tex> keeps reading 1 after the flip. It is
      non-unitary, so the state is renormalized.
    </p>
  </>
);


const Z_INFO_PHYSICAL = (
  <>
    <p className="mb-1 font-semibold">Logical phase flip (physical)</p>
    <Tex block>{String.raw`\hat Z_\Delta = \hat E_\Delta\, e^{-i\sqrt{\pi}\,\hat q}\, \hat E_\Delta^{-1},\quad \hat E_\Delta = e^{-\Delta^2 \hat a^\dagger \hat a}`}</Tex>
    <p>
      The <Tex>{String.raw`\sqrt{\pi}`}</Tex> shift in <Tex>{String.raw`p`}</Tex> dressed by the
      envelope. At small <Tex>{String.raw`\Delta`}</Tex> it nearly equals the ideal displacement;
      the gap is the finite-energy correction.
    </p>
  </>
);

const SQ_APPLY_PHYSICAL = (
  <>
    <p className="mb-1 font-semibold">Apply stabilizer along q (physical)</p>
    <Tex block>{String.raw`\hat S_{\Delta,q} = \hat E_\Delta\, e^{\,i\,2\sqrt{\pi}\,\hat p}\, \hat E_\Delta^{-1},\quad \hat E_\Delta = e^{-\Delta^2 \hat a^\dagger \hat a}`}</Tex>
  </>
);


const SP_APPLY_PHYSICAL = (
  <>
    <p className="mb-1 font-semibold">Apply stabilizer along p (physical)</p>
    <Tex block>{String.raw`\hat S_{\Delta,p} = \hat E_\Delta\, e^{-i\,2\sqrt{\pi}\,\hat q}\, \hat E_\Delta^{-1},\quad \hat E_\Delta = e^{-\Delta^2 \hat a^\dagger \hat a}`}</Tex>
  </>
);




const DELTA_INFO = (
  <>
    <p className="mb-1 font-semibold">Squeezing parameter</p>
    <Tex block>
      {String.raw`|\tilde\mu_\Delta\rangle \propto \sum_{s\in\mathbb Z} e^{-\frac{\Delta^2}{2}\,[(2s+\mu)\sqrt{\pi}]^2}
      \int\! dq\; e^{-\frac{(q-(2s+\mu)\sqrt{\pi})^2}{2\Delta^2}}\,|q\rangle`}
    </Tex>
    <p>
      Each peak has width <Tex>{String.raw`\Delta`}</Tex> and the comb sits under a Gaussian
      envelope of width <Tex>{String.raw`1/\Delta`}</Tex>. Smaller{" "}
      <Tex>{String.raw`\Delta`}</Tex> means a better code word but more photons,{" "}
      <Tex>{String.raw`\langle \hat a^\dagger \hat a\rangle \sim 1/(2\Delta^2)`}</Tex>.
    </p>
  </>
);



function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-3 py-1.5 first:border-t-0">
      <h2 className="mb-1 text-[0.56rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Slider(props: {
  label: React.ReactNode;
  readout: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.6rem] leading-tight text-foreground">{props.label}</span>
        <span className="font-mono text-[0.6rem] text-muted-foreground">{props.readout}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-0.5 h-1 w-full accent-primary"
      />
    </label>
  );
}

function CommitNumber(props: {
  value: number;
  min: number;
  max: number;
  step: number;
  round?: boolean;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(props.value));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(String(props.value));
    setDirty(false);
  }, [props.value]);

  const commit = () => {
    const v = Number(draft);
    if (!Number.isFinite(v)) {
      setDraft(String(props.value));
      setDirty(false);
      return;
    }
    let next = Math.min(props.max, Math.max(props.min, v));
    if (props.round) next = Math.round(next);
    setDraft(String(next));
    setDirty(false);
    if (next !== props.value) props.onCommit(next);
  };

  return (
    <input
      type="number"
      min={props.min}
      max={props.max}
      step={props.step}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        setDirty(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      onBlur={commit}
      className={`w-14 rounded border bg-background px-1 py-0.5 text-right font-mono text-[0.6rem] text-foreground ${
        dirty ? "border-primary" : "border-border"
      }`}
    />
  );
}

export function ControlPanel(props: ControlPanelProps) {
  const dynamic = props.kappa1 > 0 || props.kappaPhi > 0;
  const time = props.stats?.time ?? 0;

  return (
    <aside
      style={props.width ? { ["--panel-w" as string]: `${props.width}px` } : undefined}
      className="flex w-full shrink-0 flex-col overflow-y-auto border-border bg-card md:h-screen md:w-[var(--panel-w,19rem)] md:border-l"
    >
      <div className="px-3 pt-2 pb-0.5">
        <h1 className="text-[0.78rem] font-semibold tracking-tight text-foreground">
          GKP Wigner explorer
        </h1>
        <p className="text-[0.6rem] leading-snug text-muted-foreground">
          Drag the plot to orbit, scroll to zoom.
        </p>
      </div>

      <Section title="Code word">
        <div className="grid grid-cols-4 gap-1">
          {LOGICALS.map((l) => (
            <HoverInfo
              key={l.key}
              align="left"
              className="w-full"

              info={
                <>
                  <p className="mb-1 font-semibold">{l.title}</p>
                  <Tex block>{l.expr}</Tex>
                </>
              }
            >
              <button
                onClick={() => props.onLogical(l.key)}
                className={`w-full rounded border px-0.5 py-0.5 text-[0.62rem] leading-tight transition-colors ${
                  props.logical === l.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                <Tex>{l.label}</Tex>
              </button>
            </HoverInfo>
          ))}

        </div>
      </Section>

      <Section title="Code lattice">
        <div className="grid grid-cols-2 gap-1">
          {LATTICES.map((l) => (
            <HoverInfo
              key={l.key}
              align="left"
              className="w-full"
              info={
                <>
                  <p className="mb-1 font-semibold">{l.title}</p>
                  <Tex block>{l.expr}</Tex>
                </>
              }
            >
              <button
                onClick={() => props.onLatticeKind(l.key)}
                className={`w-full rounded border px-0.5 py-0.5 text-[0.62rem] leading-tight transition-colors ${
                  props.latticeKind === l.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                <Tex>{l.label}</Tex>
              </button>
            </HoverInfo>
          ))}
        </div>
        {props.latticeKind === "rect" && (
          <div className="mt-1">
            <Slider
              label={<Tex>{String.raw`r`}</Tex>}
              readout={props.latticeRatio.toFixed(2)}
              min={0.5}
              max={2}
              step={0.05}
              value={props.latticeRatio}
              onChange={props.onLatticeRatio}
            />
          </div>
        )}
      </Section>

      <Section title="Squeezing">
        <Slider
          label={
            <HoverInfo align="left" info={DELTA_INFO}>
              <Tex className="cursor-help underline decoration-dotted underline-offset-2">
                {String.raw`\Delta`}
              </Tex>
            </HoverInfo>
          }
          readout={`${props.delta.toFixed(3)} · ${(-20 * Math.log10(props.delta)).toFixed(1)} dB`}
          min={0.15}
          max={0.6}
          step={0.005}
          value={props.delta}
          onChange={props.onDelta}
        />
        <label className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[0.6rem] text-foreground">
            <Tex>{String.raw`N`}</Tex> — Fock cutoff
          </span>
          <span className="flex items-center gap-1">
            <CommitNumber
              value={props.cutoff}
              min={FOCK_CUTOFF_MIN}
              max={FOCK_CUTOFF_MAX}
              step={1}
              round
              onCommit={props.onCutoff}
            />
            <span className="text-[0.56rem] text-muted-foreground">
              {FOCK_CUTOFF_MIN}–{FOCK_CUTOFF_MAX} ⏎
            </span>
          </span>
        </label>
        {props.truncationWarning && (
          <p className="mt-1 text-[0.58rem] leading-snug text-destructive">
            Fock truncation stressed here — results near <Tex>{String.raw`\Delta = 0.15`}</Tex> are
            approximate.
          </p>
        )}
      </Section>

      <Section title="Operations">
        <div className="flex flex-wrap items-center gap-1">
          <HoverInfo align="left" info={X_INFO_PHYSICAL}>
            <button
              onClick={() => props.onGate("X")}
              className="cursor-help rounded border border-border bg-background px-1.5 py-0.5 text-[0.62rem] text-foreground transition-colors hover:bg-accent"
            >
              <Tex>{String.raw`\hat X_\Delta`}</Tex> — bit flip
            </button>
          </HoverInfo>
          <HoverInfo align="left" info={Z_INFO_PHYSICAL}>
            <button
              onClick={() => props.onGate("Z")}
              className="cursor-help rounded border border-border bg-background px-1.5 py-0.5 text-[0.62rem] text-foreground transition-colors hover:bg-accent"
            >
              <Tex>{String.raw`\hat Z_\Delta`}</Tex> — phase flip
            </button>
          </HoverInfo>
          <HoverInfo align="left" info={SQ_APPLY_PHYSICAL}>
            <button
              onClick={() => props.onGate("Sq")}
              className="cursor-help rounded border border-border bg-background px-1.5 py-0.5 text-[0.62rem] text-foreground transition-colors hover:bg-accent"
            >
              <Tex>{String.raw`\hat S_{\Delta,q}`}</Tex> — stabilizer
            </button>
          </HoverInfo>
          <HoverInfo align="left" info={SP_APPLY_PHYSICAL}>
            <button
              onClick={() => props.onGate("Sp")}
              className="cursor-help rounded border border-border bg-background px-1.5 py-0.5 text-[0.62rem] text-foreground transition-colors hover:bg-accent"
            >
              <Tex>{String.raw`\hat S_{\Delta,p}`}</Tex> — stabilizer
            </button>
          </HoverInfo>


          <button
            onClick={props.onReset}
            className="flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[0.62rem] text-muted-foreground transition-colors hover:bg-accent"
          >
            <RotateCcw className="size-2.5" /> reset
          </button>
          <span className="ml-auto font-mono text-[0.6rem] text-muted-foreground">
            {props.gates.length ? props.gates.join("·") : "—"}
          </span>
        </div>

      </Section>

      <Section title="Jump operators">
        <Slider
          label={<Tex>{String.raw`\kappa_1 \;\text{— loss},\; \hat L = \sqrt{\kappa_1}\,\hat a`}</Tex>}
          readout={props.kappa1.toFixed(2)}
          min={0}
          max={0.5}
          step={0.01}
          value={props.kappa1}
          onChange={props.onKappa1}
        />
        <div className="mt-1">
          <Slider
            label={
              <Tex>
                {String.raw`\kappa_\phi \;\text{— dephasing},\; \hat L = \sqrt{\kappa_\phi}\,\hat a^\dagger \hat a`}
              </Tex>
            }
            readout={props.kappaPhi.toFixed(2)}
            min={0}
            max={0.5}
            step={0.01}
            value={props.kappaPhi}
            onChange={props.onKappaPhi}
          />
        </div>
      </Section>


      <Section title="Time evolution">
        <label className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[0.66rem] text-foreground">
            <Tex>{String.raw`t_{\max}`}</Tex>
          </span>

          <span className="flex items-center gap-1">
            <CommitNumber
              value={props.timeWindow}
              min={0.1}
              max={10}
              step={0.1}
              onCommit={props.onTimeWindow}
            />
            <span className="text-[0.56rem] text-muted-foreground">max 10 ⏎</span>
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            disabled={!dynamic}
            onClick={() => props.onPlaying(!props.playing)}
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            aria-label={props.playing ? "Pause" : "Play"}
          >
            {props.playing ? <Pause className="size-3" /> : <Play className="size-3" />}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, props.frameCount - 1)}
            step={1}
            value={props.frameIndex}
            disabled={!dynamic}
            onChange={(e) => {
              props.onPlaying(false);
              props.onFrameIndex(Number(e.target.value));
            }}
            className="h-1 w-full accent-primary disabled:opacity-40"
          />
          <span className="w-14 shrink-0 text-[0.62rem] text-muted-foreground">
            <Tex>{String.raw`t = ${time.toFixed(2)}`}</Tex>
          </span>

        </div>
        <button
          onClick={() => props.onShowStabilizers(!props.showStabilizers)}
          className={`mt-1 flex w-full items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-[0.62rem] transition-colors ${
            props.showStabilizers
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:bg-accent"
          }`}
        >
          <LineChart className="size-2.5" />
          {props.showStabilizers ? "hide" : "show"} stabilizers vs time
        </button>
        {dynamic && props.computing && (
          <p className="mt-1 font-mono text-[0.6rem] text-muted-foreground">
            solving Lindblad… {props.loadedFrames}/{props.frameCount}
          </p>
        )}
      </Section>


      <Section title="Diagnostics">
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <Row
            label={String.raw`\langle \hat S_{\Delta,q}\rangle`}
            value={(props.stats?.sq ?? 0).toFixed(4)}
            info={SQ_INFO}
          />
          <Row
            label={String.raw`\langle \hat S_{\Delta,p}\rangle`}
            value={(props.stats?.sp ?? 0).toFixed(4)}
            info={SP_INFO}
          />
          <Row
            label={String.raw`\mathrm{Tr}\,\hat\rho^2`}
            value={(props.stats?.purity ?? 0).toFixed(4)}
          />
          <Row
            label={String.raw`\langle \hat a^\dagger \hat a\rangle`}
            value={(props.stats?.meanPhotons ?? 0).toFixed(3)}
          />
          <Row
            label={String.raw`\sum_{n>N-5} \rho_{nn}`}
            value={(props.stats?.tailPopulation ?? 0).toExponential(1)}
            info={TAIL_INFO}
          />
        </div>
      </Section>


    </aside>
  );
}
