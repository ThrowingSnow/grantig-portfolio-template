import * as React from "react";
import { PanelHint, VisuallyHidden } from "onepage-chrome";

// PanelHint breathes 0.35→1 opacity on an infinite loop. A still capture
// freezes infinite animations at their FIRST frame — the faintest one — and
// with --clr-muted at 45% alpha that lands near 16% effective opacity, so the
// card reads as empty. Pin the hint to the peak of its own pulse, which is the
// state the eye actually registers on the running page.
const HintAtPeak = () => (
  <style>{`.panel__hint { animation: none; opacity: 1; }`}</style>
);

/**
 * How the demo carries its headline: the document's real `<h1>` sits right
 * above the hint for screen readers and crawlers while WebGL redraws it. The
 * card shows only the hint, with no headline above and no gap where one would
 * be — the missing line IS the component working.
 */
export const HiddenHeadline = () => (
  <div style={{ padding: "2rem" }}>
    <HintAtPeak />
    <VisuallyHidden as="h1">Lorem ipsum dolor sit amet</VisuallyHidden>
    <PanelHint>move the cursor · then scroll</PanelHint>
  </div>
);
