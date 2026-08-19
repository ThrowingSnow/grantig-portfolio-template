import * as React from "react";

export interface VisuallyHiddenProps {
  /** Render as a different element, e.g. `h1` for a hidden headline. */
  as?: "div" | "span" | "p" | "h1" | "h2";
  children?: React.ReactNode;
  className?: string;
}

/**
 * Removes content from the visual page while leaving it in the accessibility
 * tree and the DOM.
 *
 * The original page leans on this hard: the real `<h1>` and the body
 * paragraphs are visually hidden and their text is re-drawn in WebGL, so the
 * document stays readable to screen readers and crawlers while the canvas
 * does the typography.
 */
export function VisuallyHidden({
  as: Tag = "div",
  children,
  className,
}: VisuallyHiddenProps) {
  return (
    <Tag className={className ? `visually-hidden ${className}` : "visually-hidden"}>
      {children}
    </Tag>
  );
}
