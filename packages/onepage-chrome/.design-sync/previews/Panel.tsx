import * as React from "react";
import { Panel, PanelHint, PanelNote, VisuallyHidden } from "onepage-chrome";

// PanelHint breathes 0.35→1 opacity on an infinite loop. A still capture
// freezes infinite animations at their FIRST frame — the faintest one — and
// with --clr-muted at 45% alpha that lands near 16% effective opacity, so the
// card reads as empty. Pin the hint to the peak of its own pulse, which is the
// state the eye actually registers on the running page.
const HintAtPeak = () => (
  <style>{`.panel__hint { animation: none; opacity: 1; }`}</style>
);
/** `hero` — 100vh, content anchored to the bottom edge. The opening beat. */
export const Hero = () => (
  <Panel variant="hero">
    <HintAtPeak />
    <VisuallyHidden as="h1">Lorem ipsum dolor sit amet</VisuallyHidden>
    <PanelHint>move the cursor · then scroll</PanelHint>
  </Panel>
);

/**
 * `hold` — 240vh, the longest beat and visually empty by design: its
 * paragraphs stay in the accessibility tree while the arrow deforms and the
 * text flies in through WebGL. The tall, bare ground IS the panel.
 */
export const Hold = () => (
  <Panel variant="hold">
    <VisuallyHidden>
      <p>
        Lorem ipsum dolor sit amet consectetur adipiscing elit sed tempor
        incididunt labore.
      </p>
      <p>
        Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi
        aliquip commodo.
      </p>
    </VisuallyHidden>
  </Panel>
);

/** `gravity` — 220vh and the one variant that anchors content to the top. */
export const Gravity = () => (
  <Panel variant="gravity">
    <PanelNote>keep scrolling — gravity follows your wheel</PanelNote>
  </Panel>
);

/** `outro` — 90vh, the shortest beat, closing on the warm note. */
export const Outro = () => (
  <Panel variant="outro">
    <PanelNote tone="end">
      the letters rest on the node · scroll back up to reset
    </PanelNote>
  </Panel>
);
