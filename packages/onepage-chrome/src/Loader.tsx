import * as React from "react";

export interface LoaderProps {
  /** While true, the overlay covers the page. Unmount or flip to false when ready. */
  active?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Full-bleed loading curtain: the background colour covers everything and a
 * 100px accent hairline sweeps left-to-right and back on a 1.4s loop.
 *
 * Wrap the page in it while assets load — the original page keeps it up
 * until the fonts and WebGL scene are ready, then drops it.
 */
export function Loader({ active = true, children, className }: LoaderProps) {
  const classes: Array<string> = [];
  if (active) classes.push("loading");
  if (className) classes.push(className);
  return <div className={classes.join(" ")}>{children}</div>;
}
