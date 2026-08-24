import * as THREE from "three";

import Commons from "../classes/Commons";
import Typography from "./Typography";
import { Phases } from "./Director";
import {
  COLORS,
  TUNE,
  clamp01,
  easeOutExpo,
  lerp,
  smoothstep,
} from "./settings";

interface Props {
  scene: THREE.Scene;
  typography: Typography;
  words: Array<string>;
}

/**
 * The size the block is built at. It is scaled to the viewport every frame, so
 * this is only the resolution the geometry is cut at — and a fixed number keeps
 * every glyph on the cache key `Typography` already holds them under.
 */
const BUILT_AT = 100;

/** How far the block is kept off the camera's near plane, in pixels. */
const CLIP_MARGIN = 120;

/**
 * Share of a line's travel spent winding up against the way out.
 *
 * The whole point of the last panel is that a line is *pushed*, so it has to
 * load first. Not a knob: below a fifth of the travel the wind-up is gone
 * before the eye finds it, and much above that the line reads as drifting the
 * wrong way rather than as being shoved.
 */
const WIND_SHARE = 0.22;

/** One line of the block — the unit the last panel takes the block apart in. */
interface Line {
  group: THREE.Group;
  /** Where the line sits in the block, in block units. */
  home: THREE.Vector2;
  /** Height of the line's letters, in block units — not the leading. */
  height: number;
  /** Half the line's width, in block units. */
  reach: number;
  /** The side of the frame it is driven out of. */
  side: 1 | -1;
  /** Its place in the order the lines are taken away in. */
  order: number;
}

/**
 * A line's negative: the band of ground it drags in behind itself as it goes.
 * Pixels, measured from the middle of the frame, y up — `NegativeBands` turns
 * them into quads held at its own distance.
 */
export interface Strip {
  y: number;
  height: number;
  /** How much of the frame the band has taken over, 0…1. */
  cover: number;
  /** The side the line left by — the band fills in from the other one. */
  side: 1 | -1;
}

/** Small deterministic PRNG, so an order drawn once survives every rebuild. */
const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * The last beat: the words of the second level come down as one block, and the
 * panel after that takes it apart again.
 *
 * Everything the reader has seen of this level was read in passing — single
 * words standing off the path, met one at a time by a camera that never stops.
 * Here they arrive all at once, set solid, filling the frame, and the arrow
 * that has been riding in front of the lens for the whole level is driven out
 * of the bottom of it. The page has spent ten panels moving the arrow through
 * text; it ends with the text moving the arrow.
 *
 * Then the block is unmade. Every line has a scroll threshold of its own, and
 * crossing one shoves that line out of the frame — in an order drawn at random,
 * so the block comes apart in a way that cannot be read ahead. What each line
 * drags in behind it is the negative of the ground it was standing on, in
 * exactly its own letters' height. By the last threshold the level's pale
 * ground is gone and what is left is the stack of bands the lines cut out of
 * it: the page ends on black and white, which is where it started.
 *
 * It is held against the camera rather than placed in the world, like the arrow
 * beside it: at this point the rig is somewhere down the far end of a Bézier,
 * and a block that has to fill the frame has no business being anywhere the
 * lens is not. Same deal as `DeformArrow.escort()` — pixels at the camera's own
 * distance, multiplied back out by however much the lens magnifies at the depth
 * it is held at, so the depth buys occlusion and nothing else.
 */
export default class AnvilText {
  private commons: Commons;
  private scene: THREE.Scene;
  private typography: Typography;
  private words: Array<string>;

  private group = new THREE.Group();
  private material: THREE.MeshStandardMaterial;

  /** The block's own size at `BUILT_AT`, before it is fitted to the viewport. */
  private width = 1;
  private height = 1;

  private lines: Array<Line> = [];

  /**
   * Drawn once and kept. The order is meant to be unreadable, not unstable: a
   * resize rebuilds the geometry, and a block that reshuffled itself while the
   * reader was halfway through taking it apart would move lines they had
   * already pushed away.
   */
  private seed = Math.floor(Math.random() * 0xffffffff);

  /** How far past the strike the arrow has been driven, 0…1. */
  private punted = 0;
  /** How far the arrow has been brought to a standstill for it, 0…1. */
  private stilled = 0;

  /** How many lines have been fired so far — `main` kicks the frame on each. */
  private fired = 0;
  private bands: Array<Strip> = [];

  private local = new THREE.Vector3();

  constructor({ scene, typography, words }: Props) {
    this.commons = Commons.getInstance();
    this.scene = scene;
    this.typography = typography;
    this.words = words;

    this.material = new THREE.MeshStandardMaterial({
      color: COLORS.driftInk,
      metalness: 0.15,
      roughness: 0.42,
      emissive: COLORS.driftHot.clone().multiplyScalar(0.06),
    });

    this.build();

    this.group.visible = false;
    this.scene.add(this.group);
  }

  /**
   * The whole run of words as one paragraph, wrapped into a block.
   *
   * Wrapped rather than one word per line: eight words stacked would be a
   * narrow column with air either side of it, and the point of this beat is
   * that there is no air left. `columns` decides how wide a line may get, which
   * is really a choice of the block's proportions — the fit below rescales it
   * to the frame either way.
   *
   * The lines are kept apart rather than poured into one group, because the
   * panel after this one moves them one at a time. Each one is re-centred on
   * its own letters, so it turns around itself on the way out instead of
   * swinging around the middle of the block.
   */
  private build() {
    const layout = this.typography.layout([this.words.join(" ")], {
      size: BUILT_AT,
      maxWidth: BUILT_AT * TUNE.anvil.columns,
      lineHeight: BUILT_AT * 1.06,
      blockGap: 0,
    });

    this.width = Math.max(1, layout.width);
    this.height = Math.max(1, layout.height);

    interface Row {
      group: THREE.Group;
      box: THREE.Box2;
    }

    const rows = new Map<number, Row>();

    for (const placed of layout.chars) {
      const glyph = this.typography.glyph(placed.char, {
        size: BUILT_AT,
        depth: BUILT_AT * 0.3,
        bevel: false,
      });

      if (!glyph) continue;

      const x = placed.x + glyph.offset.x;
      const y = placed.y + glyph.offset.y;

      const mesh = new THREE.Mesh(glyph.geometry, this.material);
      mesh.position.set(x, y, 0);

      let row = rows.get(placed.line);

      if (!row) {
        row = { group: new THREE.Group(), box: new THREE.Box2() };
        row.box.makeEmpty();
        rows.set(placed.line, row);
      }

      row.group.add(mesh);
      row.box.expandByPoint(
        new THREE.Vector2(x - glyph.size.x / 2, y - glyph.size.y / 2)
      );
      row.box.expandByPoint(
        new THREE.Vector2(x + glyph.size.x / 2, y + glyph.size.y / 2)
      );
    }

    const ordered = [...rows.entries()].sort(([a], [b]) => a - b);
    const random = mulberry(this.seed);

    // Draw the order first and the sides after, so both are stable for a given
    // seed and line count no matter what the layout above did to the geometry.
    const order = ordered.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const slots = new Array<number>(order.length);
    order.forEach((line, slot) => (slots[line] = slot));

    this.lines = ordered.map(([, row], index) => {
      const centre = row.box.getCenter(new THREE.Vector2());
      const size = row.box.getSize(new THREE.Vector2());

      // Re-centre: the meshes keep their places relative to each other, the
      // group carries where the line sits. That is what lets a line be moved
      // and turned as a line.
      row.group.children.forEach((mesh) => {
        mesh.position.x -= centre.x;
        mesh.position.y -= centre.y;
      });

      row.group.position.set(centre.x, centre.y, 0);
      this.group.add(row.group);

      return {
        group: row.group,
        home: centre,
        height: Math.max(1, size.y),
        reach: Math.max(1, size.x / 2),
        side: random() < 0.5 ? -1 : 1,
        order: slots[index],
      } as Line;
    });
  }

  /** Word set and proportions are read while building, so the panel can rebuild. */
  rebuild() {
    const children = [...this.group.children];
    children.forEach((child) => this.group.remove(child));
    this.lines = [];
    this.build();
  }

  /** How still the arrow is being held, 0…1 — read by `DeformArrow.escort()`. */
  get calm() {
    return this.stilled;
  }

  /** How far the strike has driven the arrow out of the frame, 0…1. */
  get punt() {
    return this.punted;
  }

  /**
   * How many lines have been shoved out so far. It only ever counts up while
   * the reader goes forward — `main` watches it for the moment to kick the
   * frame, which is the whole tactile half of a threshold.
   */
  get struck() {
    return this.fired;
  }

  /** The negatives the lines are dragging in, for `NegativeBands` to draw. */
  get strips(): Array<Strip> {
    return this.bands;
  }

  /**
   * Everything here hangs off the scroll rather than off a timer, so the block
   * can be pulled back up out of the frame as readily as it was dropped. Must
   * be called after the rig has moved, and before the arrow is escorted — the
   * arrow asks it what has already happened to it this frame.
   */
  update(phases: Phases) {
    const { flip, drift } = phases;
    const { anvil } = TUNE;

    const land = Math.max(anvil.start + 0.01, anvil.land);

    const fall = clamp01((drift - anvil.start) / (land - anvil.start));
    const past = clamp01((drift - land) / Math.max(0.001, anvil.punt));

    // The arrow is brought to a standstill on the way in, not by the blow: it
    // has to be visibly waiting under the block for the block to read as
    // falling on it.
    this.stilled = flip > 0
      ? smoothstep(anvil.start - anvil.still, anvil.start, drift)
      : 0;
    this.punted = flip > 0 ? past : 0;

    this.group.visible = flip > 0 && fall > 0.001;

    if (!this.group.visible) {
      this.bands = [];
      this.fired = 0;
      return;
    }

    const camera = this.commons.camera;

    const fit = Math.min(
      (window.innerWidth * anvil.fill) / this.width,
      (window.innerHeight * anvil.fill) / this.height
    );

    // Falling, not gliding: the travel is squared, so it enters slowly and
    // arrives at speed. Above the frame it starts clear of its own height, or
    // the top line would already be showing before the drop begins.
    const from = window.innerHeight / 2 + (this.height * fit) / 2 + anvil.lift;
    const y = lerp(from, anvil.rest, fall * fall) + this.recoil(past);

    this.strip(phases, fit, y);

    const held = Math.max(anvil.depth, camera.near + CLIP_MARGIN);
    const perspective = held / this.commons.distanceFromCamera;

    this.local.set(0, y * perspective, -held);
    camera.updateMatrixWorld();
    this.group.position.copy(camera.localToWorld(this.local));

    this.group.quaternion.copy(camera.quaternion);
    this.group.scale.setScalar(fit * perspective);
  }

  /**
   * The last panel: one threshold per line, spread evenly over it.
   *
   * The lines do not queue up behind each other — every one is on its own slot
   * of the scroll, so what the reader is really turning is a row of switches
   * they cannot see the labels of. Nothing here is fired and forgotten: a line's
   * place is a function of where the scroll is, so scrolling back up pulls the
   * block, and the ground under it, straight back together.
   */
  private strip(phases: Phases, fit: number, blockY: number) {
    const { strip } = TUNE;
    const count = this.lines.length;

    // What is left of the panel once the run-up and the run-out are taken off
    // it, shared between the gaps. The last line therefore *starts* leaving
    // `tail` from the end and is out with the panel, not after it.
    const step =
      count > 1
        ? Math.max(0, 1 - strip.lead - strip.tail - strip.travel) / (count - 1)
        : 0;

    const bands: Array<Strip> = [];
    let fired = 0;

    for (const line of this.lines) {
      const trigger = strip.lead + line.order * step;
      const crossed = clamp01(
        (phases.strip - trigger) / Math.max(0.001, strip.travel)
      );

      // Winds up against the way out, then goes. `easeOutExpo` on the launch is
      // what makes it a shove rather than a slide: nearly all of the travel is
      // spent in the first third of the slot, and the rest is the line already
      // being gone.
      const wound = Math.sin(Math.PI * clamp01(crossed / WIND_SHARE));
      const launch = clamp01((crossed - WIND_SHARE) / (1 - WIND_SHARE));
      const gone = easeOutExpo(launch);

      // Far enough that the trailing edge is past the frame, not just the
      // middle of the line — `push` is then how much further than that.
      const exit = (window.innerWidth / 2 + line.reach * fit) * strip.push;
      const offset = line.side * (gone * exit - strip.wind * wound);

      line.group.position.set(line.home.x + offset / fit, line.home.y, 0);
      line.group.rotation.z = -line.side * strip.spin * gone;

      if (launch > 0) fired++;
      if (crossed <= 0) continue;

      // The band is on the same slot but on a slower curve, so it is always
      // behind the line that is pulling it and catches up exactly as that line
      // clears the frame. `drag` is how far behind.
      bands.push({
        y: blockY + line.home.y * fit,
        height: line.height * fit * strip.band,
        cover: Math.pow(launch, 1 + strip.drag * 3),
        side: line.side,
      });
    }

    this.bands = bands;
    this.fired = fired;
  }

  /**
   * The rebound. A sine rather than a cosine so it starts at nothing: the
   * block lands where it was going to land and springs from there, instead of
   * jumping the moment the strike is crossed.
   */
  private recoil(past: number) {
    if (past <= 0) return 0;
    return Math.exp(-past * 7) * Math.sin(past * 22) * TUNE.anvil.recoil;
  }
}
