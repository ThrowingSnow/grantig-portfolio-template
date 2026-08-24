import * as THREE from "three";

import Commons from "../classes/Commons";
import Typography from "./Typography";
import { Strip } from "./AnvilText";
import { Phases } from "./Director";
import { TUNE, clamp01, easeOutExpo } from "./settings";

interface Props {
  scene: THREE.Scene;
  typography: Typography;
  lines: Array<string>;
}

/** The size a line is built at, before it is fitted to the band it goes in. */
const BUILT_AT = 100;

/** How far the copy is kept off the camera's near plane, in pixels. */
const CLIP_MARGIN = 120;

interface Letter {
  object: THREE.LineSegments;
  material: THREE.LineBasicMaterial;
  /** Where it belongs, in the line's own units. */
  home: THREE.Vector2;
  /** Where it is thrown in from, in the same units. */
  from: THREE.Vector3;
  /** The tumble it arrives out of. */
  spin: THREE.Euler;
  /** Its place in the order the line is thrown in, 0…1. */
  order: number;
}

interface Row {
  group: THREE.Group;
  letters: Array<Letter>;
  /** The line's own size at `BUILT_AT`. */
  width: number;
  height: number;
}

/** Small deterministic PRNG — the same throw every time the panel is scrolled. */
const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * The copy that is written into the bands the last block left behind.
 *
 * Everything the page has set until here has been solid: extruded, lit, given a
 * physics body, thrown around. This is the opposite of all of it. The letters
 * are drawn as their own outlines and nothing else — one pixel wide however
 * large they are set, because WebGL draws every line at one pixel and here that
 * limitation is the design. Set in the pale the bands were cut out of, they are
 * the positive of the ground standing in the negative of it.
 *
 * They are not laid down, they are thrown: every letter comes in from somewhere
 * else, tumbling, on its own moment of the scroll, and the line is only a line
 * once the last one has stopped. In an order drawn at random, so a word does not
 * spell itself out left to right — it collects.
 *
 * The bands are read off `AnvilText` every frame rather than measured here, and
 * matched by `Strip.row`: the copy for the third line of the block goes in the
 * band the third line of the block cut, whatever order they were cut in.
 */
export default class EtchedLines {
  private commons: Commons;
  private scene: THREE.Scene;
  private typography: Typography;
  private lines: Array<string>;

  private group = new THREE.Group();
  private rows: Array<Row> = [];

  private seed = Math.floor(Math.random() * 0xffffffff);

  private ink = new THREE.Color();
  private local = new THREE.Vector3();
  private travel = new THREE.Vector3();

  constructor({ scene, typography, lines }: Props) {
    this.commons = Commons.getInstance();
    this.scene = scene;
    this.typography = typography;
    this.lines = lines;

    this.build();

    this.group.visible = false;
    this.scene.add(this.group);
  }

  /**
   * One group per line of copy, centred on itself. The advance widths are the
   * font's own, the same ones `Typography.layout()` sets solid text with, so a
   * hairline line and a solid one of the same string are the same width.
   */
  private build() {
    const random = mulberry(this.seed);
    const { etch } = TUNE;

    this.rows = this.lines.map((text) => {
      const group = new THREE.Group();
      const width = this.typography.measure(text, BUILT_AT);

      const letters: Array<Letter> = [];
      let height = 1;
      let x = -width / 2;

      for (const char of text) {
        const outline = this.typography.outline(char, BUILT_AT);
        const advance = this.typography.advance(char, BUILT_AT);

        if (!outline) {
          x += advance;
          continue;
        }

        height = Math.max(height, outline.size.y);

        const material = new THREE.LineBasicMaterial({
          transparent: true,
          opacity: 1,
          fog: false,
          toneMapped: false,
        });

        const object = new THREE.LineSegments(outline.geometry, material);

        letters.push({
          object,
          material,
          home: new THREE.Vector2(x + outline.offset.x, outline.offset.y),
          // Thrown in from anywhere but where it belongs, near and far alike:
          // a swarm that all comes from one side reads as a slide, not a throw.
          from: new THREE.Vector3(
            (random() * 2 - 1) * etch.throw * BUILT_AT,
            (random() * 2 - 1) * etch.throw * BUILT_AT,
            (random() * 2 - 1) * etch.throw * BUILT_AT * 0.8
          ),
          spin: new THREE.Euler(
            (random() * 2 - 1) * etch.tumble,
            (random() * 2 - 1) * etch.tumble,
            (random() * 2 - 1) * etch.tumble
          ),
          order: 0,
        });

        group.add(object);
        x += advance;
      }

      // The arrival order last, over the letters that actually got one — a line
      // whose spaces counted would have gaps in its own timing.
      const order = letters.map((_, index) => index);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      const last = Math.max(1, order.length - 1);
      order.forEach((letter, slot) => (letters[letter].order = slot / last));

      this.group.add(group);

      return { group, letters, width, height };
    });
  }

  /** Throw and tumble are read while building, so the panel can rebuild. */
  rebuild() {
    const children = [...this.group.children];
    children.forEach((child) => this.group.remove(child));

    this.rows.forEach((row) =>
      row.letters.forEach((letter) => letter.material.dispose())
    );

    this.rows = [];
    this.build();
  }

  /**
   * Must be called after `AnvilText.update()`, which is what works out where
   * the bands are this frame.
   */
  update(phases: Phases, strips: Array<Strip>) {
    this.group.visible = phases.etch > 0 && strips.length > 0;
    if (!this.group.visible) return;

    const camera = this.commons.camera;
    const { anvil, strip, etch } = TUNE;

    // In front of the bands and behind where the block stood: the copy sits on
    // the negative, not in it.
    const held = Math.max(
      anvil.depth + strip.behind - etch.float,
      camera.near + CLIP_MARGIN
    );
    const perspective = held / this.commons.distanceFromCamera;

    // The pale the bands were cut out of. Taken off the scene rather than
    // written down, for the same reason the bands take their own colour there.
    const ground = this.scene.background as THREE.Color | null;
    if (ground) this.ink.copy(ground);

    camera.updateMatrixWorld();

    const rows = Math.max(1, this.rows.length - 1);

    this.rows.forEach((row, index) => {
      const band = strips.find((cut) => cut.row === index);

      row.group.visible = !!band && band.cover > 0.999;
      if (!band || !row.group.visible) return;

      const fit = Math.min(
        (band.height * etch.height) / row.height,
        (window.innerWidth * etch.fill) / row.width
      );

      this.local.set(0, band.y * perspective, -held);
      row.group.position.copy(camera.localToWorld(this.local));
      row.group.quaternion.copy(camera.quaternion);
      row.group.scale.setScalar(fit * perspective);

      const opens = etch.lead + (index / rows) * etch.rows;

      row.letters.forEach((letter) => {
        const due = opens + letter.order * etch.stagger;
        const settled = clamp01(
          (phases.etch - due) / Math.max(0.001, etch.settle)
        );

        letter.object.visible = settled > 0;
        if (!letter.object.visible) return;

        const eased = easeOutExpo(settled);

        this.travel.set(
          letter.home.x + letter.from.x,
          letter.home.y + letter.from.y,
          letter.from.z
        );

        letter.object.position.set(
          this.travel.x + (letter.home.x - this.travel.x) * eased,
          this.travel.y + (letter.home.y - this.travel.y) * eased,
          this.travel.z * (1 - eased)
        );

        letter.object.rotation.set(
          letter.spin.x * (1 - eased),
          letter.spin.y * (1 - eased),
          letter.spin.z * (1 - eased)
        );

        // Comes up out of nothing over the first part of the throw, so a letter
        // that is still halfway across the frame is not competing with the ones
        // that have landed. Fragile has to arrive quietly.
        letter.material.color.copy(this.ink);
        letter.material.opacity = clamp01(settled / etch.fade);
      });
    });
  }
}
