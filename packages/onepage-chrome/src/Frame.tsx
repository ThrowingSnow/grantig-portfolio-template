import * as React from "react";

export interface FrameProps {
  /** Left-hand label. Bold, widely tracked, uppercase. */
  title: React.ReactNode;
  /** Right-hand credit line. Muted, lowercase, hidden below 700px. */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * Fixed page chrome pinned to the top edge — a title on the left, an optional
 * meta/credit line on the right.
 *
 * Renders with `mix-blend-mode: difference`, so it inverts against whatever
 * scrolls beneath it and stays legible over both dark ground and bright
 * artwork. It is `pointer-events: none`; put interactive elements elsewhere.
 */
export function Frame({ title, meta, className }: FrameProps) {
  return (
    <header className={className ? `frame ${className}` : "frame"}>
      <span className="frame__title">{title}</span>
      {meta ? <span className="frame__meta">{meta}</span> : null}
    </header>
  );
}
