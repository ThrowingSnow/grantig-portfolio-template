import type { PanelName } from "./Director";

/**
 * Description of every knob `/config.html` may turn.
 *
 * It lives next to `settings.ts` on purpose: a value that gets a slider without
 * an entry here is invisible in the panel, and an entry whose `path` no longer
 * exists shows up as a dead row the first time the page is opened — both are
 * caught by looking at the panel once, which is cheaper than a test.
 */
export interface Knob {
  /** Dotted path into `TUNE`, e.g. `well.radial`. */
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /**
   * Knobs that are only read while the scene is being laid out. Turning one
   * triggers a relayout instead of waiting for the next frame.
   */
  structural?: boolean;
}

export interface KnobGroup {
  title: string;
  /** The phase this group is worth watching in — the panel can jump there. */
  phase?: PanelName;
  note?: string;
  knobs: Array<Knob>;
}

export const TUNE_GROUPS: Array<KnobGroup> = [
  {
    title: "Surface & Gate",
    phase: "split",
    note: "The floor the letters pile up on, and how it swings open.",
    knobs: [
      { path: "surface.band", label: "Height", min: 0.05, max: 0.4, step: 0.005, structural: true },
      { path: "surface.depth", label: "Slab depth", min: 20, max: 240, step: 5, unit: "px", structural: true },
      { path: "surface.gate", label: "Opening angle", min: 0, max: 120, step: 0.1, unit: "°" },
    ],
  },
  {
    title: "The fall",
    phase: "gravity",
    note: "Flicking the wheel is what adds the haptic part on top.",
    knobs: [
      { path: "fall.gravity", label: "Gravity", min: 200, max: 3000, step: 25 },
      { path: "fall.haptic", label: "Scroll boost", min: 0, max: 6000, step: 50 },
    ],
  },
  {
    title: "Gravity well",
    phase: "orbit",
    note: "A spring onto each letter's own orbit, not a 1/r² attraction.",
    knobs: [
      { path: "well.radial", label: "Radial spring", min: 0.5, max: 16, step: 0.1 },
      { path: "well.drive", label: "Tangential drive", min: 0, max: 8, step: 0.1 },
      { path: "well.slab", label: "Flattening", min: 0, max: 10, step: 0.1 },
      { path: "well.speed", label: "Orbit speed", min: 0, max: 400, step: 5, unit: "px/s" },
      { path: "well.inner", label: "Closest orbit", min: 1.05, max: 4, step: 0.05, unit: "×r" },
      { path: "well.spread", label: "Orbit spread", min: 0, max: 4, step: 0.05, unit: "×r" },
    ],
  },
  {
    title: "The sphere",
    phase: "orbit",
    knobs: [
      { path: "sphere.scale", label: "Size", min: 0.04, max: 0.3, step: 0.005, structural: true },
      { path: "sphere.min", label: "Minimum", min: 40, max: 200, step: 2, unit: "px", structural: true },
      { path: "sphere.max", label: "Maximum", min: 100, max: 480, step: 5, unit: "px", structural: true },
    ],
  },
  {
    title: "Lens on the line",
    phase: "orbit",
    note: "Click the sphere first. Spacing survives at 1 − push / spread.",
    knobs: [
      { path: "lens.push", label: "Parting", min: 0, max: 4, step: 0.05, unit: "×r" },
      { path: "lens.spread", label: "Reach", min: 1, max: 20, step: 0.25, unit: "×r" },
      { path: "lens.lift", label: "Bend height", min: 0, max: 2.5, step: 0.05, unit: "×r" },
      { path: "lens.bend", label: "Bend length", min: 0.4, max: 8, step: 0.1, unit: "×r" },
    ],
  },
  {
    title: "Grid",
    phase: "orbit",
    knobs: [
      { path: "grid.reach", label: "Dent width", min: 0.5, max: 8, step: 0.1, unit: "×r", structural: true },
      { path: "grid.depth", label: "Dent depth", min: 0, max: 900, step: 10, unit: "px", structural: true },
      { path: "grid.distance", label: "Distance", min: 100, max: 1400, step: 10, unit: "px", structural: true },
    ],
  },
  {
    title: "Post lens",
    phase: "orbit",
    knobs: [
      { path: "post.deflect", label: "Deflection", min: 0, max: 1.2, step: 0.01 },
      { path: "post.ring", label: "Ring", min: 0, max: 2, step: 0.01 },
    ],
  },
  {
    title: "The departure",
    phase: "orbit",
    note: "Click the sphere to watch this one — it only runs once per scroll.",
    knobs: [
      { path: "depart.distance", label: "Travel", min: 600, max: 5000, step: 50, unit: "px" },
      { path: "depart.time", label: "Duration", min: 0.4, max: 6, step: 0.1, unit: "s" },
      { path: "depart.pull", label: "Pull onto the mass", min: 0, max: 1, step: 0.01 },
      { path: "depart.swirl", label: "Turns on the way in", min: 0, max: 5, step: 0.1 },
    ],
  },
  {
    title: "The line it leaves",
    phase: "orbit",
    note: "At an overlap of 1 the sphere is completely gone before the line forms.",
    knobs: [
      { path: "core.overlap", label: "Overlap", min: 0, max: 1, step: 0.01 },
      { path: "core.stagger", label: "Arrival spread", min: 0, max: 0.9, step: 0.01 },
      { path: "core.wobble", label: "Settle overshoot", min: 0, max: 80, step: 1, unit: "px" },
    ],
  },
  {
    title: "The clearing",
    phase: "sweep",
    note: "The arrow's run through the finished line. It needs the sphere clicked first.",
    knobs: [
      { path: "sweep.scale", label: "Size of the run", min: 0.6, max: 3.5, step: 0.05 },
      { path: "sweep.push", label: "Sideways kick", min: 0, max: 1600, step: 20, unit: "px/s" },
      { path: "sweep.lift", label: "Upward kick", min: 0, max: 900, step: 10, unit: "px/s" },
      { path: "sweep.gravity", label: "Gravity after", min: 0, max: 2, step: 0.05 },
    ],
  },
  {
    title: "The second level",
    phase: "drift",
    note: "The camera ride. Jump to flip or drift — none of it moves before that.",
    knobs: [
      { path: "drift.lead", label: "Look ahead", min: 0.005, max: 0.15, step: 0.005 },
      { path: "drift.roll", label: "Roll into turns", min: 0, max: 3, step: 0.05 },
      { path: "drift.morph", label: "Morph amplitude", min: 0, max: 120, step: 1 },
      { path: "drift.frequency", label: "Morph frequency", min: 0.001, max: 0.05, step: 0.001 },
      { path: "drift.size", label: "Word size", min: 60, max: 420, step: 5, structural: true },
      { path: "drift.offset", label: "Off the centre line", min: 0, max: 700, step: 10, structural: true },
    ],
  },
  {
    title: "The tear",
    phase: "orbit",
    note: "Fires once on the click, in the frame and on the button alike.",
    knobs: [
      { path: "glitch.time", label: "Duration", min: 0, max: 2, step: 0.05, unit: "s" },
      { path: "glitch.amount", label: "Displacement", min: 0, max: 0.2, step: 0.005 },
    ],
  },
];

export interface Swatch {
  key: string;
  label: string;
}

/**
 * Colours are baked into materials and uniforms when the scene is built, so the
 * panel reloads the frame after one changes instead of chasing every material.
 */
export const TUNE_COLORS: Array<Swatch> = [
  { key: "background", label: "Background" },
  { key: "accent", label: "Accent" },
  { key: "cold", label: "Cold" },
  { key: "grid", label: "Grid" },
  { key: "banner", label: "Banner" },
  { key: "bannerHot", label: "Banner hover" },
  { key: "paragraph", label: "Paragraphs" },
  { key: "node", label: "Surface" },
  { key: "drift", label: "Level two ground" },
  { key: "driftInk", label: "Level two ink" },
  { key: "driftHot", label: "Level two accent" },
];
