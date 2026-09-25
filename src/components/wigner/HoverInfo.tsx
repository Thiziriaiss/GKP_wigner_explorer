import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface HoverInfoProps {
  /** The always-visible trigger content. */
  children: ReactNode;
  /** The panel content, revealed on hover or keyboard focus. */
  info: ReactNode;
  className?: string;
  /** Preferred horizontal alignment of the panel relative to the trigger. */
  align?: "left" | "right";
}

const PANEL_WIDTH = 256; // matches w-64
const MARGIN = 8;

/**
 * A lightweight hover card used to show LaTeX definitions next to a control.
 * The panel is positioned with fixed coordinates and clamped to the viewport so
 * it can never be cropped by the edge of the screen.
 */
export function HoverInfo({ children, info, className, align = "right" }: HoverInfoProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = align === "right" ? r.right - PANEL_WIDTH : r.left;
    left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - PANEL_WIDTH - MARGIN));

    const h = panelRef.current?.offsetHeight ?? 120;
    let top = r.top - h - 6;
    if (top < MARGIN) top = Math.min(r.bottom + 6, vh - h - MARGIN);
    top = Math.max(MARGIN, top);

    setPos({ left, top });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Re-measure once the panel (KaTeX) has laid out.
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [open, place]);

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className ?? ""}`}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          ref={panelRef}
          className="pointer-events-none fixed z-50 w-64 overflow-hidden rounded-md border border-border bg-card/98 p-2 text-[0.62rem] leading-relaxed break-words text-foreground shadow-lg backdrop-blur [&_.katex-display]:my-1 [&_.katex-display>.katex]:max-w-full [&_.katex]:text-[0.72rem]"
          style={{
            left: pos?.left ?? -9999,
            top: pos?.top ?? -9999,
            visibility: pos ? "visible" : "hidden",
          }}
        >
          {info}
        </span>
      )}
    </span>
  );
}

export default HoverInfo;
