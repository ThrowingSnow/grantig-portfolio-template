import * as React from "react";

export type PanelVariant = "hero" | "hold" | "gravity" | "outro";

export interface PanelProps {
  /**
   * Which beat of the scroll story this panel is. The variant sets the
   * panel's height and how its content is anchored:
   * `hero` 100vh, `hold` 240vh, `gravity` 220vh (content to the top),
   * `outro` 90vh.
   */
  variant: PanelVariant;
  children?: React.ReactNode;
  className?: string;
}

/**
 * A full-viewport beat of the scroll story. Content sits at the bottom edge,
 * centred — except `gravity`, which anchors to the top.
 *
 * Panel heights are the timing source of truth: they come from the
 * `--panel-*` tokens, and the original page reads the rendered offsets to
 * drive its animation, so changing a token re-times the story.
 */
export function Panel({ variant, children, className }: PanelProps) {
  return (
    <section
      className={className ? `panel ${className}` : "panel"}
      data-panel={variant}
    >
      {children}
    </section>
  );
}
