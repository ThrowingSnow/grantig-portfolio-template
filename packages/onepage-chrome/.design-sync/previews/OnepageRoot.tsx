import * as React from "react";
import {
  Frame,
  Hud,
  Panel,
  PanelHint,
  PanelNote,
  VisuallyHidden,
} from "onepage-chrome";

// PanelHint breathes 0.35→1 opacity on an infinite loop. A still capture
// freezes infinite animations at their FIRST frame — the faintest one — and
// with --clr-muted at 45% alpha that lands near 16% effective opacity, so the
// card reads as empty. Pin the hint to the peak of its own pulse, which is the
// state the eye actually registers on the running page.
const HintAtPeak = () => (
  <style>{`.panel__hint { animation: none; opacity: 1; }`}</style>
);
/**
 * The page's opening screen, exactly as the demo composes it: fixed frame at
 * the top, a hero panel whose real headline is visually hidden because WebGL
 * redraws it, and the HUD in the bottom gutter.
 */
export const OnePage = () => (
  <>
    <HintAtPeak />
    <Frame title={"Lorem Ipsum / One Page"} meta="three.js · cannon-es · lenis" />
    <Panel variant="hero">
      <VisuallyHidden as="h1">Lorem ipsum dolor sit amet</VisuallyHidden>
      <PanelHint>move the cursor · then scroll</PanelHint>
    </Panel>
    <Hud phase="banner" value={0} />
  </>
);

/** The closing screen — outro panel, warm final note, meter at full charge. */
export const ClosingScreen = () => (
  <>
    <Frame title={"Lorem Ipsum / One Page"} meta="three.js · cannon-es · lenis" />
    <Panel variant="outro">
      <PanelNote tone="end">
        the letters rest on the node · scroll back up to reset
      </PanelNote>
    </Panel>
    <Hud phase="gravity" value={1} />
  </>
);
