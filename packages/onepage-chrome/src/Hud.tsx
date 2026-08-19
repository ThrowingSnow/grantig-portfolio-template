import * as React from "react";

export interface HudProps {
  /** Current phase name, e.g. `banner`, `hold`, `gravity`. Accent-coloured. */
  phase: string;
  /**
   * Charge value in the range 0–1. Printed to two decimals in tabular
   * figures and drawn as the meter's fill.
   */
  value: number;
  className?: string;
}

/**
 * Heads-up display pinned to the bottom-left gutter: the phase name, the
 * numeric charge value, and a hairline meter that fills with it.
 *
 * The value is set in tabular figures so the number doesn't jitter as it
 * counts. The meter fills by scaling on the X axis from the left edge.
 * Non-interactive — it reports state, it doesn't accept input.
 */
export function Hud({ phase, value, className }: HudProps) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <aside className={className ? `hud ${className}` : "hud"} aria-hidden="true">
      <span className="hud__phase">{phase}</span>
      <span className="hud__value">{clamped.toFixed(2)}</span>
      <span className="hud__track">
        <i className="hud__bar" style={{ transform: `scaleX(${clamped})` }} />
      </span>
    </aside>
  );
}
