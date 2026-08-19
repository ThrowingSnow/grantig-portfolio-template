import * as React from "react";
import { Frame, Hud, Panel, PanelHint, Loader } from "onepage-chrome";

// PanelHint breathes 0.35→1 opacity on an infinite loop. A still capture
// freezes infinite animations at their FIRST frame — the faintest one — and
// with --clr-muted at 45% alpha that lands near 16% effective opacity, so the
// card reads as empty. Pin the hint to the peak of its own pulse, which is the
// state the eye actually registers on the running page.
const HintAtPeak = () => (
  <style>{`.panel__hint { animation: none; opacity: 1; }`}</style>
);
// What the curtain covers, so the lifted state has something to reveal.
const Page = () => (
  <>
    <HintAtPeak />
    <Frame title={"Lorem Ipsum / One Page"} meta="three.js · cannon-es · lenis" />
    <Panel variant="hero">
      <PanelHint>move the cursor · then scroll</PanelHint>
    </Panel>
    <Hud phase="banner" value={0} />
  </>
);

/** Assets still loading: the ground covers everything, the accent hairline sweeps. */
export const Active = () => (
  <Loader active>
    <Page />
  </Loader>
);

/** Dropped — the same tree with the curtain off. */
export const Lifted = () => (
  <Loader active={false}>
    <Page />
  </Loader>
);
