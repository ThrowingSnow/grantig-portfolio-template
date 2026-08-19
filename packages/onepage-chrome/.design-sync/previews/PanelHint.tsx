import * as React from "react";
import { PanelHint } from "onepage-chrome";

// PanelHint breathes 0.35→1 opacity on an infinite loop. A still capture
// freezes infinite animations at their FIRST frame — the faintest one — and
// with --clr-muted at 45% alpha that lands near 16% effective opacity, so the
// card reads as empty. Pin the hint to the peak of its own pulse, which is the
// state the eye actually registers on the running page.
const HintAtPeak = () => (
  <style>{`.panel__hint { animation: none; opacity: 1; }`}</style>
);
/**
 * The one instruction the hero panel carries — muted bone, tracked out to
 * 0.32em. On the running page it breathes between 35% and full opacity on a
 * 3.2s loop; this card shows it at the peak of that pulse.
 */
export const Default = () => (
  <div style={{ padding: "2rem" }}>
    <HintAtPeak />
    <PanelHint>move the cursor · then scroll</PanelHint>
  </div>
);
