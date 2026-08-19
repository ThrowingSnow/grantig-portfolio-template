import * as React from "react";
import { PanelNote } from "onepage-chrome";

// The note has margin:0 and takes the page ground from OnepageRoot, so the
// preview supplies the gutter a panel would normally give it.
const Gutter = ({ children }: { children?: React.ReactNode }) => (
  <div style={{ padding: "2rem" }}>{children}</div>
);

/** The running commentary in the gravity panel — muted bone. */
export const Narration = () => (
  <Gutter>
    <PanelNote>keep scrolling — gravity follows your wheel</PanelNote>
  </Gutter>
);

/** The closing beat, tinted accent-orange at 60%. */
export const ClosingBeat = () => (
  <Gutter>
    <PanelNote tone="end">
      the letters rest on the node · scroll back up to reset
    </PanelNote>
  </Gutter>
);
