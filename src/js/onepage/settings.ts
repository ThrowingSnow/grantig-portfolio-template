import * as THREE from "three";

/** Layout: the content block is always 75% of the viewport width, centered. */
export const CONTENT_WIDTH_RATIO = 0.75;

/**
 * Vertical position of the node the letters come to rest on, measured from the
 * bottom of the viewport. Sits inside the requested 10–15% band.
 */
export const NODE_BAND = 0.125;

/** Depth of the slab the falling letters are kept in, so the pile stays readable. */
export const PILE_DEPTH = 90;

export const FONT_URL = "/fonts/helvetiker_bold.typeface.json";

export const COLORS = {
  background: new THREE.Color("#08090c"),
  banner: new THREE.Color("#e9e4d8"),
  bannerHot: new THREE.Color("#ff6a3d"),
  paragraph: new THREE.Color("#d7d3c8"),
  accent: new THREE.Color("#ff6a3d"),
  cold: new THREE.Color("#3ddcff"),
  node: new THREE.Color("#ff6a3d"),
};

export const contentWidth = () => window.innerWidth * CONTENT_WIDTH_RATIO;

/** World-space y of the node's top surface. */
export const nodeSurfaceY = () =>
  -window.innerHeight / 2 + window.innerHeight * NODE_BAND;

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const easeOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

export const easeOutBack = (t: number) => {
  const c1 = 1.20158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
