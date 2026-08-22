import * as THREE from "three";

import Commons from "../classes/Commons";
import Typography from "./Typography";
import { Phases } from "./Director";
import { COLORS, TUNE, clamp01, lerp, smoothstep } from "./settings";

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
 * The last beat: the words of the second level come down as one block.
 *
 * Everything the reader has seen of this level was read in passing — single
 * words standing off the path, met one at a time by a camera that never stops.
 * Here they arrive all at once, set solid, filling the frame, and the arrow
 * that has been riding in front of the lens for the whole level is driven out
 * of the bottom of it. The page has spent ten panels moving the arrow through
 * text; it ends with the text moving the arrow.
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

  /** How far past the strike the arrow has been driven, 0…1. */
  private punted = 0;
  /** How far the arrow has been brought to a standstill for it, 0…1. */
  private stilled = 0;

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

    for (const placed of layout.chars) {
      const glyph = this.typography.glyph(placed.char, {
        size: BUILT_AT,
        depth: BUILT_AT * 0.3,
        bevel: false,
      });

      if (!glyph) continue;

      const mesh = new THREE.Mesh(glyph.geometry, this.material);
      mesh.position.set(
        placed.x + glyph.offset.x,
        placed.y + glyph.offset.y,
        0
      );

      this.group.add(mesh);
    }
  }

  /** Word set and proportions are read while building, so the panel can rebuild. */
  rebuild() {
    const meshes = [...this.group.children];
    meshes.forEach((mesh) => this.group.remove(mesh));
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
    if (!this.group.visible) return;

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

    const held = Math.max(anvil.depth, camera.near + CLIP_MARGIN);
    const perspective = held / this.commons.distanceFromCamera;

    this.local.set(0, y * perspective, -held);
    camera.updateMatrixWorld();
    this.group.position.copy(camera.localToWorld(this.local));

    this.group.quaternion.copy(camera.quaternion);
    this.group.scale.setScalar(fit * perspective);
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
