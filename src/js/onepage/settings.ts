import * as THREE from "three";

/** Layout: the content block is always 75% of the viewport width, centered. */
export const CONTENT_WIDTH_RATIO = 0.75;

export const FONT_URL = "/fonts/helvetiker_bold.typeface.json";

/** The second level is set in a different face — that is half of its identity. */
export const DRIFT_FONT_URL = "/fonts/gentilis_bold.typeface.json";

/**
 * Every number the scene is tuned with, in one mutable object.
 *
 * Mutable on purpose: `/config.html` runs this page in an iframe and writes
 * straight into this object, so a slider moves the scene on the next frame
 * instead of after a rebuild. Everything here is therefore read *per frame* or
 * on the next `onResize()` — never captured in a module-level `const`.
 */
export const TUNE = {
  /** The surface the letters land on, and the gate it turns into. */
  surface: {
    /** Height of the surface above the bottom of the viewport, 0…1. */
    band: 0.125,
    /** Depth of the slab the falling letters are kept in, in pixels. */
    depth: 90,
    /** How far the two halves swing down when the gate opens, in degrees. */
    gate: 79.2,
  },

  /** The fall onto the surface. */
  fall: {
    /** Base gravity, in pixels per second². */
    gravity: 1100,
    /** Extra gravity a fast scroll adds — flick the wheel and they are ripped off. */
    haptic: 2400,
  },

  /**
   * The gravity well in the void: a radial spring onto each letter's own orbit
   * radius plus a tangential drive, instead of raw Newtonian attraction. Real
   * 1/r² orbits either escape or fall in — this stays a readable swarm.
   */
  well: {
    /** Stiffness of the radial spring, in 1/s². */
    radial: 5.5,
    /** How hard the tangential speed is driven towards its target. */
    drive: 2.4,
    /** Spring keeping the swarm inside a shallow slab around z = 0. */
    slab: 3.2,
    /** Tangential speed the letters settle on, in pixels per second. */
    speed: 155,
    /** Closest orbit a letter can be assigned, in sphere radii. */
    inner: 1.45,
    /** How much further out than `inner` the widest orbit sits. */
    spread: 1.55,
  },

  /** The black sphere. One world unit is one pixel, so this is all in pixels. */
  sphere: {
    /** Radius as a share of the shorter viewport edge. */
    scale: 0.125,
    min: 88,
    max: 200,
  },

  /** How the sphere bends the line of text it composes. See `lens()`. */
  lens: {
    /** How far the line is parted, in sphere radii. */
    push: 1.35,
    /** How far out the parting reaches, in sphere radii. */
    spread: 8,
    /** Height of the bend where the halves leave the mass, in sphere radii. */
    lift: 0.6,
    /** How quickly the bend settles back onto the baseline, in sphere radii. */
    bend: 2.2,
  },

  /** The grid the mass dents, sitting behind everything. */
  grid: {
    /** How far the dent reaches, in sphere radii. */
    reach: 2.4,
    /** How deep the dent goes, in pixels. */
    depth: 250,
    /** Distance behind the screen plane, in pixels. */
    distance: 520,
  },

  /** The gravitational lens in the post pass. */
  post: {
    /** How hard the image is pushed away from the mass. */
    deflect: 0.22,
    /** Brightness of the ring at the horizon. */
    ring: 0.45,
  },

  /** The sphere's retreat after the click, and the tow it puts on the swarm. */
  depart: {
    /** How far back the sphere travels before the fog has it, in pixels. */
    distance: 2600,
    /** Seconds the whole hand-over takes, retreat and return together. */
    time: 2.6,
    /**
     * How far the swarm is drawn onto the sphere's centre while it is towed
     * along, 0…1. Without it the letters fly straight back in formation, which
     * reads as a camera move rather than as a mass dragging them in. Near 1
     * they are pulled all the way into the mass before it takes them.
     */
    pull: 0.85,
    /**
     * Turns each letter is carried around the sphere on the way in. It keeps
     * its own orbit axis and its own direction, so the swarm winds up rather
     * than falling in — the orbit does not stop, it tightens.
     */
    swirl: 1.6,
  },

  /** The line that pops back out of the depth once the mass is gone. */
  core: {
    /**
     * Share of the hand-over that is over before the first letter comes back.
     * Everything is still on its way out until then, so this is also how long
     * the frame is left empty.
     */
    overlap: 0.52,
    /** Spread of the arrival times over the swarm, as a share of the return. */
    stagger: 0.4,
    /** How far a letter overshoots its place before it settles, in pixels. */
    wobble: 24,
  },

  /**
   * The arrow running through the finished line and clearing it away. It does
   * not fade the letters out: they are handed back to the physics engine and
   * struck, so what leaves the frame is the same matter that arrived.
   */
  sweep: {
    /** How much bigger the arrow gets for the run. */
    scale: 1.7,
    /** Sideways speed it knocks a letter away with, in pixels per second. */
    push: 640,
    /** Upward part of that kick — without it they only slide. */
    lift: 240,
    /** Share of the normal gravity that pulls the debris down afterwards. */
    gravity: 0.8,
  },

  /**
   * The arrow's second life, after the run through the line is over.
   *
   * It curves back to the middle of the frame and stays there: from the
   * crossing on, the arrow is the one thing that does not move. It is held in
   * front of the lens and the world is flown past it, which is the inverse of
   * everything above — up there the arrow travelled and the frame stood still.
   *
   * Distances are in pixels at the camera's own distance, not in path units:
   * the arrow is placed in the camera's own space, so the page's pixel
   * convention still holds for it after it has stopped holding for the level.
   */
  escort: {
    /** How much bigger than its resting size it is held. */
    scale: 1.15,
    /** How far it swings either side of the middle, in pixels. */
    swing: 300,
    /** Where it rides relative to the middle — positive is below it. */
    drop: 60,
    /** How far it rides up and down over a swing, in pixels. */
    bob: 90,
    /** How far in front of the lens it is held, in pixels. */
    depth: 760,
    /**
     * How far that distance swings. This is the whole trick of the level: the
     * words stand off the path, so an arrow whose depth crosses theirs passes
     * behind one and in front of the next without ever leaving the middle.
     */
    weave: 420,
    /** Swings over the whole level. */
    rate: 3.5,
    /** How hard it banks into a swing, in radians. */
    bank: 0.9,
    /** How far it tumbles around its own long axis, in radians. */
    spin: 1.2,
    /** How deep the curve back to the middle dips on its way, in pixels. */
    arc: 260,
    /** The distance it comes back in at, before it settles at `depth`. */
    entry: 900,
  },

  /**
   * The last beat: the level's words come down as one block and drive the
   * arrow out of the frame.
   *
   * The timings are shares of the second level's own panel, so they read as
   * places on the ride rather than as seconds — nothing on this page is played
   * back on a clock. Like the escort, the distances are pixels at the camera's
   * own distance: the block is held against the lens, not stood in the world.
   */
  anvil: {
    /** Where on the ride the block starts coming down, 0…1 of the level. */
    start: 0.72,
    /** Where it lands — the strike. */
    land: 0.88,
    /** How long before the drop the arrow is brought to a standstill for it. */
    still: 0.14,
    /** How much of the ride the arrow takes to be driven out after the strike. */
    punt: 0.06,
    /** Share of the frame the block is fitted to, 0…1. */
    fill: 0.92,
    /** How wide a line of it may get, in ems — really the block's proportions. */
    columns: 10,
    /** Where it comes to rest relative to the middle; positive is above it. */
    rest: 0,
    /** Extra height it starts above the frame, in pixels. */
    lift: 220,
    /** How far it springs back after the strike, in pixels. */
    recoil: 46,
    /** How far in front of the lens it is held, in pixels. */
    depth: 420,
  },

  /**
   * The second level: the camera comes off its fixed spot and rides a Bézier
   * through a run of word gates. This is the one place where a world unit is no
   * longer a CSS pixel, so everything here is in path units, not in pixels.
   */
  drift: {
    /** How far ahead on the path the camera looks, 0…1 of the whole ride. */
    lead: 0.035,
    /** How hard the horizon tilts into the turns. */
    roll: 1,
    /** Amplitude of the wave running through the letters, in world units. */
    morph: 26,
    /** How tight that wave is. Higher is more chewed up, lower is a slow bend. */
    frequency: 0.011,
    /** Size the words are built at, in world units. */
    size: 118,
    /**
     * How far a word stands off the centre line of the path. It has to clear
     * its own width, or the camera spends the whole pass-by inside the letters
     * and there is nothing left to read.
     */
    offset: 420,
  },

  /** The tear that runs through the frame at the moment of the click. */
  glitch: {
    /** Seconds the burst lasts. */
    time: 0.45,
    /** How far the torn bands are displaced, in uv. */
    amount: 0.035,
  },
};

export const COLORS = {
  background: new THREE.Color("#08090c"),
  banner: new THREE.Color("#e9e4d8"),
  bannerHot: new THREE.Color("#ff6a3d"),
  paragraph: new THREE.Color("#d7d3c8"),
  accent: new THREE.Color("#ff6a3d"),
  cold: new THREE.Color("#3ddcff"),
  node: new THREE.Color("#ff6a3d"),
  grid: new THREE.Color("#26344f"),

  /**
   * The second level. It inverts: after eight panels of black the ground goes
   * pale, and the letters go dark on it. That flip is the level's whole
   * announcement, so the two are kept next to each other rather than derived.
   */
  drift: new THREE.Color("#f2efe6"),
  driftInk: new THREE.Color("#16131c"),
  driftHot: new THREE.Color("#8b2fd6"),
};

/** Kept as its own name because it reads better at the call sites. */
export const WELL = TUNE.well;

export const contentWidth = () => window.innerWidth * CONTENT_WIDTH_RATIO;

/** World-space y of the surface the letters land on. */
export const nodeSurfaceY = () =>
  -window.innerHeight / 2 + window.innerHeight * TUNE.surface.band;

/** Radius of the black sphere in pixels — one world unit equals one pixel at z = 0. */
export const sphereRadius = () =>
  Math.min(
    TUNE.sphere.max,
    Math.max(
      TUNE.sphere.min,
      Math.min(window.innerWidth, window.innerHeight) * TUNE.sphere.scale
    )
  );

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const easeOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutBack = (t: number) => {
  const c1 = 1.20158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export interface Lensed {
  x: number;
  y: number;
  /** 1 right at the mass, 0 far away from it. */
  falloff: number;
  /** How far the point was pushed sideways out of the shadow, in pixels. */
  push: number;
  /** Slope of the bend at this point, in radians — letters ride it. */
  tilt: number;
}

/**
 * Gravitational lens around a mass sitting at (0, 0), for a line of text.
 *
 * Deliberately not polar: near the middle `atan2` is meaningless, so a radial
 * push flings the innermost letters off at random angles and tears words apart.
 * This parts the line horizontally instead and shears the two halves past each
 * other, which keeps every letter in reading order.
 *
 * The parting decays much more slowly than it is strong (8 vs 1.35), because
 * the spacing between two letters survives at `1 - push / spread` — a short
 * falloff would squeeze the words into each other on the way out.
 */
export const lens = (x: number, y: number, radius: number): Lensed => {
  const { push: amount, spread, lift: height, bend: reach } = TUNE.lens;
  const side = x < 0 ? -1 : 1;

  const falloff = Math.exp(-Math.abs(x) / (radius * spread));
  const push = radius * amount * falloff;

  // The bend is short-lived where the parting is wide: each half arcs away from
  // the mass and comes back down to the baseline further out.
  const bend = Math.exp(-Math.abs(x) / (radius * reach));
  const lift = side * radius * height * bend;

  return {
    x: x + side * push,
    y: y + lift,
    falloff: bend,
    push,
    tilt: Math.atan(-(height / reach) * bend),
  };
};
