import * as THREE from "three";

import { COLORS, TUNE } from "./settings";

/** Where the config page keeps the values it is currently trying out. */
export const TUNING_KEY = "onepage:tune";

/** Where it keeps the copy it is currently trying out. */
export const COPY_KEY = "onepage:copy";

/**
 * How far the copy may stray from the lengths the scene is tuned for, either
 * way. Every character is a mesh and — while it falls — a physics body, so the
 * budget is a real one, not a style rule: see the note in the config panel.
 */
export const COPY_TOLERANCE = 0.2;

export interface Copy {
  banner: string;
  paragraphs: Array<string>;
  core: string;
  /** One word per gate on the second level's ride. */
  drift: Array<string>;
  /** One line per band the block's lines cut out of the ground. */
  etch: Array<string>;
}

export interface Tuning {
  tune: Record<string, number>;
  colors: Record<string, string>;
}

/** Snapshot of the values as they are written in `settings.ts`. */
export const DEFAULTS: Tuning = {
  tune: flatten(TUNE),
  colors: Object.fromEntries(
    Object.entries(COLORS).map(([key, color]) => [key, `#${color.getHexString()}`])
  ),
};

/** `{ well: { radial: 5.5 } }` → `{ "well.radial": 5.5 }`. */
function flatten(source: object, prefix = ""): Record<string, number> {
  const flat: Record<string, number> = {};

  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "number") flat[path] = value;
    else if (value && typeof value === "object") {
      Object.assign(flat, flatten(value, path));
    }
  }

  return flat;
}

/** Current values of everything, in the same flat shape. */
export const snapshot = (): Tuning => ({
  tune: flatten(TUNE),
  colors: Object.fromEntries(
    Object.entries(COLORS).map(([key, color]) => [key, `#${color.getHexString()}`])
  ),
});

/**
 * Writes a flat set of values back into the live objects.
 *
 * Unknown paths are skipped rather than created: they are almost always a knob
 * that was renamed in the code while an old set was still in localStorage, and
 * silently growing `TUNE` a second `well.speeed` would be worse than ignoring it.
 */
export function apply(tuning: Partial<Tuning>) {
  for (const [path, value] of Object.entries(tuning.tune ?? {})) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;

    const keys = path.split(".");
    const leaf = keys.pop();
    if (!leaf) continue;

    let target: Record<string, unknown> = TUNE as never;

    for (const key of keys) {
      const next = target[key];
      if (!next || typeof next !== "object") break;
      target = next as Record<string, unknown>;
    }

    if (typeof target[leaf] === "number") target[leaf] = value;
  }

  for (const [key, value] of Object.entries(tuning.colors ?? {})) {
    const color = (COLORS as Record<string, THREE.Color>)[key];
    if (color && /^#[0-9a-f]{6}$/i.test(value)) color.set(value);
  }
}

/**
 * Restores whatever the config page last left behind.
 *
 * Only ever called when the page is running inside the config frame — the
 * deployed one-pager has to look the same for everyone, no matter what is in
 * the visitor's localStorage.
 */
export function restore() {
  try {
    const stored = window.localStorage.getItem(TUNING_KEY);
    if (stored) apply(JSON.parse(stored) as Partial<Tuning>);
  } catch {
    // A corrupt or unreadable entry is not worth taking the page down for.
  }
}

/* Copy
--------------------------------------------------------- */

const read = (element: Element | null) =>
  (element?.textContent ?? "").replace(/\s+/g, " ").trim();

/** The copy as `index.html` ships it — what the budget is measured against. */
let shipped: Copy | null = null;

/** What the scene would render right now, straight out of the hidden DOM. */
export function readCopy(): Copy {
  return {
    banner: read(document.querySelector('[data-webgl="banner"]')),
    paragraphs: Array.from(
      document.querySelectorAll('[data-webgl="paragraph"]')
    ).map(read),
    core: read(document.querySelector('[data-webgl="core"]')),
    drift: Array.from(document.querySelectorAll('[data-webgl="drift"]')).map(read),
    etch: Array.from(document.querySelectorAll('[data-webgl="etch"]')).map(read),
  };
}

export const shippedCopy = (): Copy => shipped ?? readCopy();

/**
 * Writes copy into the hidden DOM the scene reads its text from.
 *
 * The paragraph elements are rebuilt to match how many paragraphs are given —
 * that DOM is the source of truth for the page, so the config frame has to be
 * able to show what a different number of them would actually look like.
 */
export function applyCopy(copy: Partial<Copy>) {
  const banner = document.querySelector('[data-webgl="banner"]');
  if (banner && typeof copy.banner === "string") banner.textContent = copy.banner;

  const core = document.querySelector('[data-webgl="core"]');
  if (core && typeof copy.core === "string") core.textContent = copy.core;

  rewrite("paragraph", copy.paragraphs);
  rewrite("drift", copy.drift);
  rewrite("etch", copy.etch);
}

/** Replaces every `<p>` of one kind with one per entry, in the same place. */
function rewrite(kind: string, texts: Array<string> | undefined) {
  if (!Array.isArray(texts)) return;

  const existing = Array.from(
    document.querySelectorAll(`[data-webgl="${kind}"]`)
  );
  const host = existing[0]?.parentElement;
  if (!host) return;

  const wanted = texts.map((text) => String(text).trim()).filter(Boolean);

  existing.forEach((element) => element.remove());
  wanted.forEach((text) => {
    const element = document.createElement("p");
    element.dataset.webgl = kind;
    element.textContent = text;
    host.append(element);
  });
}

/**
 * Restores whatever copy the config page last left behind — and, on the way,
 * remembers what was in the document before that, so the panel can always
 * measure against the shipped lengths rather than against its own last edit.
 */
export function restoreCopy() {
  shipped = readCopy();

  try {
    const stored = window.localStorage.getItem(COPY_KEY);
    if (stored) applyCopy(JSON.parse(stored) as Partial<Copy>);
  } catch {
    // Same as `restore()`: not worth taking the page down for.
  }
}

/** The handle the config page reaches the running scene through. */
export interface SceneHandle {
  tune: typeof TUNE;
  colors: typeof COLORS;
  defaults: Tuning;
  snapshot: () => Tuning;
  apply: (tuning: Partial<Tuning>) => void;
  /** Re-lays out the scene, for values that are only read while building. */
  refresh: () => void;
  /** The copy the scene is currently rendering. */
  copy: () => Copy;
  /** The copy as `index.html` ships it, for the panel's budget and its reset. */
  shippedCopy: Copy;
  /** Scrolls to the start of a named panel, through lenis. */
  goTo: (panel: string, offset?: number) => void;
}

declare global {
  interface Window {
    __onepage?: SceneHandle;
  }
}

/** True while the page is running inside the config frame. */
export const embedded = () => {
  try {
    return window.parent !== window && window.parent.location.origin === window.location.origin;
  } catch {
    // Cross-origin parent — not our config page.
    return false;
  }
};

export function install(
  handle: Omit<
    SceneHandle,
    "tune" | "colors" | "defaults" | "snapshot" | "apply" | "copy" | "shippedCopy"
  >
) {
  window.__onepage = {
    tune: TUNE,
    colors: COLORS,
    defaults: DEFAULTS,
    snapshot,
    apply,
    copy: readCopy,
    shippedCopy: shippedCopy(),
    ...handle,
  };

  window.dispatchEvent(new CustomEvent("onepage:ready"));
}

/**
 * The values as they would be written in `settings.ts`, for pasting back into
 * the source once a look has been found.
 */
export function toSource(tuning: Tuning) {
  const lines: Array<string> = [];
  let group = "";

  for (const [path, value] of Object.entries(tuning.tune)) {
    const [head, leaf] = path.split(".");

    if (head !== group) {
      if (group) lines.push("  },");
      lines.push(`  ${head}: {`);
      group = head;
    }

    lines.push(`    ${leaf}: ${value},`);
  }

  if (group) lines.push("  },");

  const colors = Object.entries(tuning.colors)
    .map(([key, value]) => `  ${key}: new THREE.Color("${value}"),`)
    .join("\n");

  return `export const TUNE = {\n${lines.join("\n")}\n};\n\nexport const COLORS = {\n${colors}\n};\n`;
}
