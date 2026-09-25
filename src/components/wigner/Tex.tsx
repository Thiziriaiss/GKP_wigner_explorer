import katex from "katex";
import { useMemo } from "react";

interface TexProps {
  /** LaTeX source, without delimiters. */
  children: string;
  /** Render as a centred display equation instead of inline. */
  block?: boolean;
  className?: string;
}

/** Renders a LaTeX expression with KaTeX (Computer Modern math font). */
export function Tex({ children, block = false, className }: TexProps) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: block,
        throwOnError: false,
        output: "html",
        strict: false,
        trust: false,
      }),
    [children, block],
  );

  return (
    <span
      className={className}
      // KaTeX emits its own sanitised markup.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default Tex;
