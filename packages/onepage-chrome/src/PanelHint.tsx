import * as React from "react";

export interface PanelHintProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * A muted, widely tracked instruction line — the "move the cursor · then
 * scroll" prompt in the hero panel.
 *
 * Breathes between 35% and full opacity on a 3.2s loop to draw the eye
 * without motion. Use it for the one instruction a panel needs; use
 * `PanelNote` for narration that shouldn't pulse.
 */
export function PanelHint({ children, className }: PanelHintProps) {
  return (
    <p className={className ? `panel__hint ${className}` : "panel__hint"}>
      {children}
    </p>
  );
}
