import * as React from "react";
import { Frame } from "onepage-chrome";

/** The demo's own frame: project title left, tech credits right. */
export const Default = () => (
  <Frame title={"Lorem Ipsum / One Page"} meta="three.js · cannon-es · lenis" />
);

/** Without `meta` — the same treatment the frame falls back to under 700px. */
export const TitleOnly = () => <Frame title={"Lorem Ipsum / One Page"} />;
