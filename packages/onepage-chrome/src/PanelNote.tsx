import * as React from "react";

export interface PanelNoteProps {
  /**
   * `default` is muted bone. `end` tints the note accent-orange at 60% and
   * marks the closing beat of the page.
   */
  tone?: "default" | "end";
  children?: React.ReactNode;
  className?: string;
}

/**
 * Quiet narration inside a panel — the running commentary that tells the
 * reader what the page is doing ("keep scrolling — gravity follows your
 * wheel").
 *
 * Same muted treatment as `PanelHint` but static; set `tone="end"` on the
 * final panel so the closing line reads warm rather than muted.
 */
export function PanelNote({ tone = "default", children, className }: PanelNoteProps) {
  const classes = ["panel__note"];
  if (tone === "end") classes.push("panel__note--end");
  if (className) classes.push(className);
  return <p className={classes.join(" ")}>{children}</p>;
}
