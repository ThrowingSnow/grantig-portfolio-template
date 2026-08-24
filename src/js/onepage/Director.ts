import Commons from "../classes/Commons";

export type PanelName =
  | "hero"
  | "hold"
  | "gravity"
  | "split"
  | "orbit"
  | "sweep"
  | "flip"
  | "drift"
  | "strip"
  | "etch";

interface Panel {
  top: number;
  height: number;
}

export interface Phases {
  /** Current smoothed scroll position in pixels. */
  scroll: number;
  /** Smoothed scroll velocity — the "haptic" driver of the whole page. */
  velocity: number;
  /** 0 → 1 while the banner leaves the viewport. */
  hero: number;
  /** 0 → 1 across the whole holding section. */
  hold: number;
  /** The value that has to be reached before the text is allowed to fly in. */
  charge: number;
  /** 0 → 1 while the letters fly in from all sides. */
  assemble: number;
  /** 0 → 1 while gravity takes over and the letters drop onto the surface. */
  gravity: number;
  /** 0 → 1 while the surface swings open in the middle. */
  split: number;
  /** 0 → 1 while the letters are captured by the sphere and start orbiting. */
  orbit: number;
  /** 0 → 1 while the arrow runs through the finished line and clears it. */
  sweep: number;
  /** 0 → 1 across the crossing into the second level: palette and camera. */
  flip: number;
  /** 0 → 1 while the camera rides the path through the second level. */
  drift: number;
  /** 0 → 1 while the block is taken apart, one line per threshold. */
  strip: number;
  /** 0 → 1 while the copy is thrown into the bands that are left. */
  etch: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Upper bound of the scroll velocity every effect is driven with. */
const MAX_VELOCITY = 70;

/**
 * Translates raw scroll into the named phases the scene reacts to.
 * The DOM panels are the single source of truth for the timing, so the section
 * heights can be tweaked in CSS without touching any JavaScript.
 */
export default class Director {
  private commons: Commons;
  private panels: Record<PanelName, Panel>;

  /** Share of the holding section spent charging before the text flies in. */
  private chargeThreshold = 0.42;
  /** Progress at which the fly-in is finished. */
  private assembleEnd = 0.92;

  private lerpedVelocity = 0;

  phases: Phases = {
    scroll: 0,
    velocity: 0,
    hero: 0,
    hold: 0,
    charge: 0,
    assemble: 0,
    gravity: 0,
    split: 0,
    orbit: 0,
    sweep: 0,
    flip: 0,
    drift: 0,
    strip: 0,
    etch: 0,
  };

  constructor() {
    this.commons = Commons.getInstance();
    this.panels = this.measure();
  }

  private measure(): Record<PanelName, Panel> {
    const panels = {} as Record<PanelName, Panel>;

    document.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => {
      const name = el.dataset.panel as PanelName;
      panels[name] = { top: el.offsetTop, height: el.offsetHeight };
    });

    return panels;
  }

  onResize() {
    this.panels = this.measure();
  }

  private progress(panel: Panel | undefined, scroll: number) {
    // A panel collapsed to nothing is locked away, not finished: without this
    // its zero height would read as "scrolled clean past" the moment the reader
    // reaches the panel above it.
    if (!panel || panel.height <= 0) return 0;
    return clamp01((scroll - panel.top) / panel.height);
  }

  update() {
    const scroll = this.commons.lenis.animatedScroll;

    // Lerping the velocity so a single flick doesn't spike the whole scene, and
    // clamping it because an anchor jump can report thousands of pixels at once
    // — which would tear the wave shaders apart.
    this.lerpedVelocity +=
      (this.commons.lenis.velocity - this.lerpedVelocity) * 0.12;
    this.lerpedVelocity = Math.max(
      -MAX_VELOCITY,
      Math.min(MAX_VELOCITY, this.lerpedVelocity)
    );

    const hold = this.progress(this.panels.hold, scroll);

    this.phases.scroll = scroll;
    this.phases.velocity = this.lerpedVelocity;
    this.phases.hero = this.progress(this.panels.hero, scroll);
    this.phases.hold = hold;
    this.phases.charge = clamp01(hold / this.chargeThreshold);
    this.phases.assemble = clamp01(
      (hold - this.chargeThreshold) / (this.assembleEnd - this.chargeThreshold)
    );
    this.phases.gravity = this.progress(this.panels.gravity, scroll);
    this.phases.split = this.progress(this.panels.split, scroll);
    this.phases.orbit = this.progress(this.panels.orbit, scroll);
    this.phases.sweep = this.progress(this.panels.sweep, scroll);
    this.phases.flip = this.progress(this.panels.flip, scroll);
    this.phases.drift = this.progress(this.panels.drift, scroll);
    this.phases.strip = this.progress(this.panels.strip, scroll);
    this.phases.etch = this.progress(this.panels.etch, scroll);

    return this.phases;
  }
}
